import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { Paginated } from '../common/dto/paginated';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { addDays, fromDbDate, toDbDate, weekdayOf } from '../common/utils/local-date';
import { PrismaService, PrismaTx } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import {
  CompleteHabitDto,
  CompletionDto,
  CompletionResultDto,
  ListCompletionsQueryDto,
  UndoResultDto,
} from '../habits/dto/habit.dto';
import { AchievementsService } from '../gamification/achievements.service';
import { AchievementUnlockDto, RewardsDto } from '../gamification/dto/gamification.dto';
import { XpLedgerService, WalletState } from '../gamification/xp-ledger.service';
import { levelFromXp } from '../gamification/level';
import { HABIT_XP } from '../gamification/xp-rules';
import { Achievement } from '../generated/prisma/client';
import {
  COMPLETION_ACTOR_INCLUDE,
  HabitsService,
  HabitWithRelations,
} from '../habits/habits.service';
import { effectiveHappiness } from '../pets/pet-rules';
import { PetsService } from '../pets/pets.service';
import { QuestsService } from '../quests/quests.service';
import { StreaksService } from '../streaks/streaks.service';

export interface CompleteOptions {
  /** OFFLINE_SYNC allows backfilling within OFFLINE_SYNC_WINDOW_DAYS. */
  source?: 'ONLINE' | 'OFFLINE_SYNC';
  /** Client clock at the time of the tap (stored for audit only — never trusted for dates). */
  clientCreatedAt?: Date;
}

type CompletionWithActor = Prisma.HabitCompletionGetPayload<{
  include: typeof COMPLETION_ACTOR_INCLUDE;
}>;

/**
 * Completion engine (spec §9). Everything below runs in ONE database transaction:
 * idempotency → access → date/schedule rules → insert (unique completionKey) → streak →
 * personal XP → family XP → pet XP (+ happiness) → activity stats → achievements → accessory
 * unlocks → quest progress. If any step fails nothing is recorded, so XP can never be granted
 * twice or without a completion.
 */
@Injectable()
export class CompletionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly habits: HabitsService,
    private readonly streaks: StreaksService,
    private readonly ledger: XpLedgerService,
    private readonly achievements: AchievementsService,
    private readonly pets: PetsService,
    private readonly quests: QuestsService,
    config: ConfigService<Env, true>,
  ) {
    this.offlineWindowDays = config.get('OFFLINE_SYNC_WINDOW_DAYS', { infer: true });
  }

  private readonly offlineWindowDays: number;

  async complete(
    userId: string,
    habitId: string,
    dto: CompleteHabitDto,
    opts: CompleteOptions = {},
  ): Promise<CompletionResultDto> {
    const replay = await this.findReplay(userId, habitId, dto.idempotencyKey);
    if (replay) return replay;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const ctx = await this.habits.loadContext(userId, habitId, tx);
        const { habit, today } = ctx;

        if (habit.status !== 'ACTIVE') {
          throw AppException.conflict(ErrorCode.HABIT_NOT_ACTIVE, 'Энэ дадал идэвхгүй байна.');
        }
        if (!ctx.canComplete) {
          throw AppException.forbidden(ErrorCode.NOT_ASSIGNED, 'Энэ дадал танд оноогдоогүй байна.');
        }
        // Online completions are for "today". Offline sync may backfill a few past days
        // (OFFLINE_SYNC_WINDOW_DAYS); the server's clock decides "today", never the client's.
        const date = dto.localDate ?? today;
        const window = opts.source === 'OFFLINE_SYNC' ? this.offlineWindowDays : 0;
        if (date > today) {
          throw this.unprocessable(
            ErrorCode.DATE_OUT_OF_RANGE,
            'Ирээдүйн өдрийг тэмдэглэх боломжгүй.',
          );
        }
        if (date < addDays(today, -window)) {
          throw this.unprocessable(
            ErrorCode.DATE_OUT_OF_RANGE,
            window > 0
              ? `Офлайн биелэлтийг ${window} хоногийн дотор л илгээх боломжтой.`
              : 'Зөвхөн өнөөдрийн дадлыг тэмдэглэнэ.',
          );
        }
        const start = fromDbDate(habit.startDate);
        const end = habit.endDate ? fromDbDate(habit.endDate) : null;
        if (date < start || (end && date > end)) {
          throw this.unprocessable(
            ErrorCode.DATE_OUT_OF_RANGE,
            'Энэ өдөр дадал идэвхтэй хугацаандаа биш байсан.',
          );
        }
        if (!habit.scheduleDays.some((d) => d.weekday === weekdayOf(date))) {
          throw this.unprocessable(
            ErrorCode.NOT_SCHEDULED_TODAY,
            date === today
              ? 'Өнөөдөр энэ дадлын амрах өдөр. Маргааш үргэлжлүүлээрэй!'
              : 'Тэр өдөр энэ дадлын амрах өдөр байсан.',
          );
        }

        const shared = habit.completionMode === 'SHARED';
        const completion = await tx.habitCompletion.create({
          data: {
            habitId,
            familyId: habit.familyId,
            userId: shared ? null : userId,
            completedById: userId,
            localDate: toDbDate(date),
            completionKey: `${habitId}:${shared ? 'shared' : userId}:${date}`,
            idempotencyKey: dto.idempotencyKey,
            note: dto.note || null,
            source: opts.source ?? 'ONLINE',
            clientCreatedAt: opts.clientCreatedAt ?? null,
          },
          include: COMPLETION_ACTOR_INCLUDE,
        });

        const streak = await this.streaks.recalculate(tx, habit, userId, today);

        const before = await this.ledger.personalState(tx, userId);
        const xp = HABIT_XP[habit.difficulty];
        const metadata = { habitId, habitTitle: habit.title, localDate: date };
        await this.ledger.postPersonal(tx, userId, {
          kind: 'EARN',
          amount: xp,
          sourceType: 'HABIT_COMPLETION',
          sourceId: completion.id,
          idempotencyKey: `completion:${completion.id}:PERSONAL`,
          actorId: userId,
          metadata,
        });
        // PER_MEMBER: every member's completion counts for the family.
        // SHARED: there is only one completion per day, so family XP is added exactly once.
        let family: WalletState | null = null;
        if (habit.type === 'FAMILY' && habit.familyId) {
          family = await this.ledger.postFamily(tx, habit.familyId, {
            kind: 'EARN',
            amount: xp,
            sourceType: 'HABIT_COMPLETION',
            sourceId: completion.id,
            idempotencyKey: `completion:${completion.id}:FAMILY`,
            actorId: userId,
            metadata,
          });
        }

        // Pet grows with every completed habit (spec: Pet XP by difficulty).
        const pet = await this.pets.awardForCompletion(tx, userId, completion.id, xp, metadata);

        await this.achievements.refreshActivityStats(tx, userId);
        const unlocked = await this.achievements.evaluate(tx, userId);
        const petRow = await this.pets.ensurePet(tx, userId);
        const accessories = await this.pets.syncUnlocks(tx, userId, petRow.id);
        const questsCompleted = await this.quests.refreshForUser(tx, userId);
        const after = await this.ledger.personalState(tx, userId);

        return {
          completion: this.toDto(completion),
          streak: { current: streak.current, longest: streak.longest },
          replayed: false,
          rewards: { personalXP: xp, familyXP: family ? xp : 0, petXP: xp },
          gamification: { ...after, leveledUp: after.level > before.level },
          family,
          pet,
          achievementsUnlocked: unlocked.map((a) => this.toUnlock(a)),
          accessoriesUnlocked: accessories,
          questsCompleted,
        };
      });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
      // A unique constraint fired. Either a concurrent retry with the same idempotency key
      // (→ return the first result) or the day is already completed (→ 409).
      const concurrentReplay = await this.findReplay(userId, habitId, dto.idempotencyKey);
      if (concurrentReplay) return concurrentReplay;
      throw await this.alreadyCompleted(userId, habitId, dto.localDate);
    }
  }

  async undo(userId: string, completionId: string): Promise<UndoResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const completion = await tx.habitCompletion.findUnique({ where: { id: completionId } });
      // Only the member who completed it may undo it; anything else looks like "not found".
      if (!completion || completion.completedById !== userId) {
        throw AppException.notFound(ErrorCode.COMPLETION_NOT_FOUND, 'Биелэлт олдсонгүй.');
      }
      const ctx = await this.habits.loadContext(userId, completion.habitId, tx);
      if (fromDbDate(completion.localDate) !== ctx.today) {
        throw AppException.conflict(
          ErrorCode.UNDO_WINDOW_PASSED,
          'Зөвхөн өнөөдрийн биелэлтийг буцаах боломжтой.',
        );
      }
      const rewards = await this.reverseXp(tx, completionId, userId, ctx.habit);
      await tx.habitCompletion.delete({ where: { id: completionId } });
      const streak = await this.streaks.recalculate(tx, ctx.habit, userId, ctx.today);
      await this.achievements.refreshActivityStats(tx, userId);
      // Quest progress is recounted (a completed-but-unclaimed quest can go back to in progress);
      // achievements and claimed quests stay — one-time rewards are never taken back.
      await this.quests.refreshForUser(tx, userId);
      const gamification = await this.ledger.personalState(tx, userId);
      return {
        habitId: completion.habitId,
        streak: { current: streak.current, longest: streak.longest },
        rewards,
        gamification,
      };
    });
  }

  /** Completion history. Family habits show every member's completions (family activity). */
  async list(
    userId: string,
    habitId: string,
    query: ListCompletionsQueryDto,
  ): Promise<Paginated<CompletionDto>> {
    const ctx = await this.habits.loadContext(userId, habitId);
    const where: Prisma.HabitCompletionWhereInput =
      ctx.habit.type === 'PERSONAL' ? { habitId, userId } : { habitId };
    const [rows, total] = await Promise.all([
      this.prisma.habitCompletion.findMany({
        where,
        include: COMPLETION_ACTOR_INCLUDE,
        orderBy: [{ localDate: 'desc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.habitCompletion.count({ where }),
    ]);
    return new Paginated(
      rows.map((r) => this.toDto(r)),
      total,
      query,
    );
  }

  private async findReplay(
    userId: string,
    habitId: string,
    idempotencyKey: string,
  ): Promise<CompletionResultDto | null> {
    const existing = await this.prisma.habitCompletion.findUnique({
      where: { completedById_idempotencyKey: { completedById: userId, idempotencyKey } },
      include: COMPLETION_ACTOR_INCLUDE,
    });
    if (!existing) return null;
    if (existing.habitId !== habitId) {
      throw AppException.conflict(
        ErrorCode.IDEMPOTENCY_KEY_REUSED,
        'Энэ хүсэлтийн түлхүүр өөр дадалд ашиглагдсан байна.',
      );
    }
    const detail = await this.habits.getDetail(userId, habitId);
    const earned = await this.prisma.xPTransaction.findMany({
      where: { sourceType: 'HABIT_COMPLETION', sourceId: existing.id, kind: 'EARN' },
      select: { walletType: true, amount: true },
    });
    const sum = (w: 'PERSONAL' | 'FAMILY' | 'PET') =>
      earned.filter((t) => t.walletType === w).reduce((acc, t) => acc + t.amount, 0);
    const pet = await this.prisma.userPet.findUnique({ where: { userId } });
    return {
      completion: this.toDto(existing),
      streak: detail.streak,
      replayed: true,
      rewards: { personalXP: sum('PERSONAL'), familyXP: sum('FAMILY'), petXP: sum('PET') },
      gamification: await this.ledger.personalState(this.prisma, userId),
      family: detail.familyId ? await this.ledger.familyState(this.prisma, detail.familyId) : null,
      pet: pet
        ? {
            ...levelFromXp(pet.lifetimeXP),
            lifetimeXP: pet.lifetimeXP,
            happiness: effectiveHappiness(pet.happiness, pet.happinessUpdatedAt),
            leveledUp: false,
          }
        : null,
      achievementsUnlocked: [],
      accessoriesUnlocked: [],
      questsCompleted: [],
    };
  }

  /**
   * Undo writes REVERSAL rows (the ledger is never edited). Level is re-derived from lifetime XP,
   * so it only drops if this very completion caused the level-up.
   */
  private async reverseXp(
    tx: PrismaTx,
    completionId: string,
    userId: string,
    habit: HabitWithRelations,
  ): Promise<RewardsDto> {
    const earned = await tx.xPTransaction.findMany({
      where: { sourceType: 'HABIT_COMPLETION', sourceId: completionId, kind: 'EARN' },
    });
    const rewards: RewardsDto = { personalXP: 0, familyXP: 0, petXP: 0 };
    for (const t of earned) {
      const entry = {
        kind: 'REVERSAL' as const,
        amount: -t.amount,
        sourceType: 'COMPLETION_REVERSAL' as const,
        sourceId: completionId,
        idempotencyKey: `${t.idempotencyKey}:reversal`,
        actorId: userId,
        metadata: { habitId: habit.id, habitTitle: habit.title },
      };
      if (t.walletType === 'PERSONAL' && t.userId) {
        await this.ledger.postPersonal(tx, t.userId, entry);
        rewards.personalXP -= t.amount;
      } else if (t.walletType === 'FAMILY' && t.familyId) {
        await this.ledger.postFamily(tx, t.familyId, entry);
        rewards.familyXP -= t.amount;
      } else if (t.walletType === 'PET' && t.petId) {
        // Pet XP is reversed too; unlocked accessories and happiness stay (never punitive).
        await this.ledger.postPet(tx, t.petId, entry);
        rewards.petXP -= t.amount;
      }
    }
    return rewards;
  }

  private toUnlock(a: Achievement): AchievementUnlockDto {
    return {
      id: a.id,
      key: a.key,
      title: a.title,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
    };
  }

  private async alreadyCompleted(
    userId: string,
    habitId: string,
    localDate?: string,
  ): Promise<AppException> {
    const ctx = await this.habits.loadContext(userId, habitId);
    const shared = ctx.habit.completionMode === 'SHARED';
    const date = localDate ?? ctx.today;
    const existing = await this.prisma.habitCompletion.findUnique({
      where: { completionKey: `${habitId}:${shared ? 'shared' : userId}:${date}` },
      include: COMPLETION_ACTOR_INCLUDE,
    });
    const by = existing ? this.habits.completionActor(existing) : null;
    const message =
      shared && by && by.userId !== userId
        ? `${by.displayName} ${date === ctx.today ? 'өнөөдөр' : 'тэр өдөр'} гэр бүлийн өмнөөс аль хэдийн биелүүлсэн байна.`
        : date === ctx.today
          ? 'Өнөөдөр энэ дадлыг аль хэдийн биелүүлсэн байна.'
          : 'Тэр өдөр энэ дадлыг аль хэдийн биелүүлсэн байна.';
    return AppException.conflict(ErrorCode.ALREADY_COMPLETED, message, {
      completion: existing ? this.toDto(existing) : null,
    });
  }

  private toDto(c: CompletionWithActor): CompletionDto {
    return {
      id: c.id,
      habitId: c.habitId,
      localDate: fromDbDate(c.localDate),
      completedBy: this.habits.completionActor(c),
      note: c.note,
      source: c.source,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private unprocessable(code: ErrorCode, message: string) {
    return new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message);
  }
}
