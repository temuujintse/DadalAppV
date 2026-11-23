import { Injectable } from '@nestjs/common';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { toDbDate, weekdayOf } from '../common/utils/local-date';
import { DEFAULT_TIMEZONE } from '../common/utils/timezone.util';
import { PrismaService, PrismaTx } from '../database/prisma.service';
import { FamilyAccessService, MembershipWithFamily } from '../families/family-access.service';
import { AchievementsService } from '../gamification/achievements.service';
import { WalletState, XpLedgerService } from '../gamification/xp-ledger.service';
import { Achievement, Quest, QuestProgress } from '../generated/prisma/client';
import { ClaimResultDto, QuestCompletedDto, QuestDto } from './dto/quest.dto';
import { currentPeriod, nextStatus, PeriodWindow } from './quest-period';
import { photoUrl } from '../common/utils/photo-url';

interface QuestContext {
  userId: string;
  userTz: string;
  membership: MembershipWithFamily | null;
}

/**
 * Quest engine. Progress is always *recounted* from source data (completions, care actions, XP),
 * never incremented, so undo and late edits can never leave a quest in a wrong state.
 * `refreshForUser` runs inside the caller's transaction (completion, undo, care, reads).
 */
@Injectable()
export class QuestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly ledger: XpLedgerService,
    private readonly achievements: AchievementsService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── Reads ─────────────────────────────

  async list(userId: string): Promise<QuestDto[]> {
    return this.prisma.$transaction(async (tx) => {
      const ctx = await this.context(tx, userId);
      await this.refresh(tx, ctx);
      const quests = await this.activeQuests(tx, ctx);
      // One transaction = one connection: run queries sequentially (pg forbids overlapping queries).
      const out: QuestDto[] = [];
      for (const q of quests) out.push(await this.toDto(tx, q, ctx));
      return out;
    });
  }

  async get(userId: string, questId: string): Promise<QuestDto> {
    return this.prisma.$transaction(async (tx) => {
      const ctx = await this.context(tx, userId);
      await this.refresh(tx, ctx);
      const quest = await this.findVisible(tx, ctx, questId);
      return this.toDto(tx, quest, ctx);
    });
  }

  // ───────────────────────────── Engine ─────────────────────────────

  /** Recounts every active quest for the user (and their family). Returns newly completed quests. */
  async refreshForUser(tx: PrismaTx, userId: string): Promise<QuestCompletedDto[]> {
    return this.refresh(tx, await this.context(tx, userId));
  }

  private async refresh(tx: PrismaTx, ctx: QuestContext): Promise<QuestCompletedDto[]> {
    const quests = await this.activeQuests(tx, ctx);
    const completed: QuestCompletedDto[] = [];

    for (const quest of quests) {
      const window = this.window(quest, ctx);
      const subject =
        quest.scope === 'USER'
          ? { userId: ctx.userId, familyId: null }
          : { userId: null, familyId: ctx.membership!.familyId };
      const progress = Math.min(quest.goalTarget, await this.measure(tx, quest, ctx, window));

      const existing = await tx.questProgress.findFirst({
        where: { questId: quest.id, periodKey: window.key, ...subject },
      });
      const status = nextStatus(existing?.status ?? null, progress, quest.goalTarget);
      const becameComplete = status === 'COMPLETED' && existing?.status !== 'COMPLETED';

      if (!existing) {
        // skipDuplicates: two family members completing at once must not abort each other.
        await tx.questProgress.createMany({
          data: [
            {
              questId: quest.id,
              ...subject,
              periodKey: window.key,
              progress,
              target: quest.goalTarget,
              status,
              completedAt: status === 'COMPLETED' ? new Date() : null,
            },
          ],
          skipDuplicates: true,
        });
      } else if (existing.progress !== progress || existing.status !== status) {
        await tx.questProgress.updateMany({
          where: { id: existing.id, status: { not: 'CLAIMED' } },
          data: {
            progress,
            target: quest.goalTarget,
            status,
            completedAt: status === 'COMPLETED' ? (existing.completedAt ?? new Date()) : null,
          },
        });
      }
      if (becameComplete) completed.push({ id: quest.id, title: quest.title, scope: quest.scope });
    }
    return completed;
  }

  /** Current value of the quest's metric for its subject and period. */
  private async measure(
    tx: PrismaTx,
    quest: Quest,
    ctx: QuestContext,
    w: PeriodWindow,
  ): Promise<number> {
    const dates = { gte: toDbDate(w.from), lte: toDbDate(w.to) };
    switch (quest.goalType) {
      case 'COMPLETE_HABITS':
        return tx.habitCompletion.count({ where: { completedById: ctx.userId, localDate: dates } });
      case 'PET_CARE':
        return tx.petCareAction.count({ where: { userId: ctx.userId, localDate: dates } });
      case 'COMPLETE_ALL_TODAY':
        return (await this.allDueDone(tx, ctx.userId, w.from)) ? 1 : 0;
      case 'COMPLETE_FAMILY_HABITS': {
        if (!ctx.membership) return 0;
        const members = await tx.familyMember.findMany({
          where: { familyId: ctx.membership.familyId },
          select: { userId: true },
        });
        // Every habit any current member completes counts for the family.
        return tx.habitCompletion.count({
          where: { completedById: { in: members.map((m) => m.userId) }, localDate: dates },
        });
      }
      case 'EARN_XP': {
        const sum = await tx.xPTransaction.aggregate({
          where: {
            walletType: 'PERSONAL',
            userId: ctx.userId,
            kind: { in: ['EARN', 'REVERSAL'] },
            sourceType: { not: 'QUEST' },
            createdAt: { gte: w.startsAt, lt: w.resetsAt },
          },
          _sum: { amount: true },
        });
        return Math.max(0, sum._sum.amount ?? 0);
      }
    }
  }

  /** True when the user has at least one habit due today and all of them are done. */
  private async allDueDone(tx: PrismaTx, userId: string, today: string): Promise<boolean> {
    const habits = await tx.habit.findMany({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        startDate: { lte: toDbDate(today) },
        OR: [{ endDate: null }, { endDate: { gte: toDbDate(today) } }],
        AND: [
          {
            OR: [
              { type: 'PERSONAL', creatorId: userId },
              { type: 'FAMILY', assignments: { some: { userId } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        completionMode: true,
        scheduleDays: { select: { weekday: true } },
      },
    });
    const due = habits.filter((h) => h.scheduleDays.some((d) => d.weekday === weekdayOf(today)));
    if (due.length === 0) return false;
    const done = await tx.habitCompletion.findMany({
      where: {
        habitId: { in: due.map((h) => h.id) },
        localDate: toDbDate(today),
        OR: [{ userId }, { userId: null }],
      },
      select: { habitId: true, userId: true },
    });
    return due.every((h) =>
      done.some(
        (c) =>
          c.habitId === h.id &&
          (h.completionMode === 'SHARED' ? c.userId === null : c.userId === userId),
      ),
    );
  }

  // ───────────────────────────── Claim ─────────────────────────────

  async claim(userId: string, questId: string): Promise<ClaimResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const ctx = await this.context(tx, userId);
      await this.refresh(tx, ctx);
      const quest = await this.findVisible(tx, ctx, questId);
      const w = this.window(quest, ctx);
      const row = await this.progressRow(tx, quest, ctx, w);

      if (!row || row.status === 'IN_PROGRESS') {
        throw AppException.conflict(
          ErrorCode.QUEST_NOT_COMPLETED,
          'Даалгавар хараахан биелээгүй байна. Бага зэрэг үлдлээ!',
        );
      }
      // Compare-and-swap: only one claim per quest per period, even with concurrent taps.
      const claimed = await tx.questProgress.updateMany({
        where: { id: row.id, status: 'COMPLETED' },
        data: { status: 'CLAIMED', claimedAt: new Date(), claimedById: userId },
      });
      if (claimed.count !== 1) {
        throw AppException.conflict(
          ErrorCode.QUEST_ALREADY_CLAIMED,
          'Энэ даалгаврын шагналыг аль хэдийн авсан байна.',
        );
      }

      const before = await this.ledger.personalState(tx, userId);
      const metadata = { questId: quest.id, title: quest.title, periodKey: w.key };
      if (quest.xpReward > 0) {
        await this.ledger.postPersonal(tx, userId, {
          kind: 'EARN',
          amount: quest.xpReward,
          sourceType: 'QUEST',
          sourceId: row.id,
          idempotencyKey: `quest:${row.id}:PERSONAL`,
          actorId: userId,
          metadata,
        });
      }

      let family: WalletState | null = null;
      const unlocked: Achievement[] = [];
      if (quest.scope === 'FAMILY' && ctx.membership) {
        const familyId = ctx.membership.familyId;
        await tx.familyGamification.upsert({
          where: { familyId },
          create: { familyId, questsCompleted: 1 },
          update: { questsCompleted: { increment: 1 } },
        });
        if (quest.familyXpReward > 0) {
          family = await this.ledger.postFamily(tx, familyId, {
            kind: 'EARN',
            amount: quest.familyXpReward,
            sourceType: 'QUEST',
            sourceId: row.id,
            idempotencyKey: `quest:${row.id}:FAMILY`,
            actorId: userId,
            metadata,
          });
        }
        // "Family teamwork" achievements belong to every member, not only the claimer.
        const members = await tx.familyMember.findMany({
          where: { familyId },
          select: { userId: true },
        });
        for (const m of members.filter((x) => x.userId !== userId)) {
          await this.achievements.evaluate(tx, m.userId);
        }
      }
      unlocked.push(...(await this.achievements.evaluate(tx, userId)));

      await this.audit.record(
        {
          action: AuditAction.QUEST_CLAIMED,
          entityType: 'QuestProgress',
          entityId: row.id,
          actorId: userId,
          familyId: ctx.membership?.familyId,
          metadata,
        },
        tx,
      );

      const after = await this.ledger.personalState(tx, userId);
      return {
        quest: await this.toDto(tx, quest, ctx),
        rewards: {
          personalXP: quest.xpReward,
          familyXP: family ? quest.familyXpReward : 0,
          petXP: 0,
        },
        gamification: { ...after, leveledUp: after.level > before.level },
        family,
        achievementsUnlocked: unlocked.map((a) => ({
          id: a.id,
          key: a.key,
          title: a.title,
          description: a.description,
          icon: a.icon,
          xpReward: a.xpReward,
        })),
      };
    });
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private async context(tx: PrismaTx, userId: string): Promise<QuestContext> {
    const profile = await tx.userProfile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    const membership = await this.access.findMembership(userId, tx);
    return { userId, userTz: profile?.timezone ?? DEFAULT_TIMEZONE, membership };
  }

  /** System quests + this family's own quests; family-scope quests only for family members. */
  private activeQuests(tx: PrismaTx, ctx: QuestContext): Promise<Quest[]> {
    return tx.quest.findMany({
      where: {
        isActive: true,
        ...(ctx.membership
          ? { OR: [{ familyId: null }, { familyId: ctx.membership.familyId }] }
          : { familyId: null, scope: 'USER' }),
      },
      orderBy: [{ scope: 'asc' }, { period: 'asc' }, { createdAt: 'asc' }],
    });
  }

  private async findVisible(tx: PrismaTx, ctx: QuestContext, questId: string): Promise<Quest> {
    const quests = await this.activeQuests(tx, ctx);
    const quest = quests.find((q) => q.id === questId);
    if (!quest) throw AppException.notFound(ErrorCode.QUEST_NOT_FOUND, 'Даалгавар олдсонгүй.');
    return quest;
  }

  private window(quest: Quest, ctx: QuestContext): PeriodWindow {
    const tz =
      quest.scope === 'FAMILY' ? (ctx.membership?.family.timezone ?? ctx.userTz) : ctx.userTz;
    return currentPeriod(quest.period, tz);
  }

  private progressRow(
    tx: PrismaTx,
    quest: Quest,
    ctx: QuestContext,
    w: PeriodWindow,
  ): Promise<QuestProgress | null> {
    return tx.questProgress.findFirst({
      where: {
        questId: quest.id,
        periodKey: w.key,
        ...(quest.scope === 'USER'
          ? { userId: ctx.userId }
          : { familyId: ctx.membership?.familyId ?? '00000000-0000-0000-0000-000000000000' }),
      },
    });
  }

  private async toDto(tx: PrismaTx, quest: Quest, ctx: QuestContext): Promise<QuestDto> {
    const w = this.window(quest, ctx);
    const row = await this.progressRow(tx, quest, ctx, w);
    const claimer = row?.claimedById
      ? await tx.user.findUnique({
          where: { id: row.claimedById },
          select: {
            id: true,
            profile: { select: { displayName: true, avatarKey: true, photoUpdatedAt: true } },
          },
        })
      : null;
    return {
      id: quest.id,
      key: quest.key,
      title: quest.title,
      description: quest.description,
      icon: quest.icon,
      period: quest.period,
      scope: quest.scope,
      goalType: quest.goalType,
      target: quest.goalTarget,
      progress: row?.progress ?? 0,
      status: row?.status ?? 'IN_PROGRESS',
      xpReward: quest.xpReward,
      familyXpReward: quest.familyXpReward,
      periodKey: w.key,
      resetsAt: w.resetsAt.toISOString(),
      claimedAt: row?.claimedAt?.toISOString() ?? null,
      claimedBy: claimer
        ? {
            userId: claimer.id,
            displayName: claimer.profile?.displayName ?? '—',
            avatarKey: claimer.profile?.avatarKey ?? 'fox',
            photoUrl: photoUrl(claimer.id, claimer.profile?.photoUpdatedAt),
          }
        : null,
    };
  }
}
