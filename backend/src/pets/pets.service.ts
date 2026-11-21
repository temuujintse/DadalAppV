import { HttpStatus, Injectable } from '@nestjs/common';
import { Paginated } from '../common/dto/paginated';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { localDateString } from '../common/utils/timezone.util';
import { toDbDate } from '../common/utils/local-date';
import { PrismaService, PrismaTx } from '../database/prisma.service';
import { AchievementsService } from '../gamification/achievements.service';
import { QuestsService } from '../quests/quests.service';
import { AchievementUnlockDto } from '../gamification/dto/gamification.dto';
import { levelFromXp } from '../gamification/level';
import { XpLedgerService } from '../gamification/xp-ledger.service';
import { Prisma, PetAccessory, UserPet } from '../generated/prisma/client';
import { PetCareType } from '../generated/prisma/enums';
import {
  AccessoryDto,
  AccessoryUnlockDto,
  CareResultDto,
  PetDto,
  PetHistoryItemDto,
  PetHistoryQueryDto,
  PetProgressDto,
  UpdatePetDto,
} from './dto/pet.dto';
import {
  addHappiness,
  CARE_RULES,
  COMPLETION_HAPPINESS,
  cooldownEndsAt,
  effectiveHappiness,
  moodOf,
} from './pet-rules';

const CARE_TYPES = Object.keys(CARE_RULES) as PetCareType[];

const CARE_LABELS: Record<PetCareType, string> = {
  PET: 'Илбэсэн',
  FEED: 'Хооллосон',
  PLAY: 'Тоглосон',
  BATH: 'Угаасан',
};

/**
 * Pet aggregate. Pet XP is written only through XpLedgerService (PET wallet), always inside a
 * transaction, so it obeys the same idempotency and append-only rules as personal XP.
 */
@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: XpLedgerService,
    private readonly achievements: AchievementsService,
    private readonly quests: QuestsService,
  ) {}

  // ───────────────────────────── Public API ─────────────────────────────

  async getMe(userId: string): Promise<PetDto> {
    const pet = await this.prisma.$transaction(async (tx) => {
      const p = await this.ensurePet(tx, userId);
      await this.syncUnlocks(tx, userId, p.id);
      return p;
    });
    return this.toDto(this.prisma, pet.id);
  }

  async update(userId: string, dto: UpdatePetDto): Promise<PetDto> {
    const pet = await this.prisma.$transaction(async (tx) => {
      const p = await this.ensurePet(tx, userId);
      return tx.userPet.update({
        where: { id: p.id },
        data: { name: dto.name, species: dto.species },
      });
    });
    return this.toDto(this.prisma, pet.id);
  }

  async care(userId: string, type: PetCareType, idempotencyKey: string): Promise<CareResultDto> {
    const replay = await this.findCareReplay(userId, idempotencyKey);
    if (replay) return replay;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await this.ensurePet(tx, userId);
        // Serialise care actions per pet so two quick taps cannot both pass the cooldown check.
        await tx.$queryRaw`SELECT id FROM "UserPet" WHERE id = ${created.id}::uuid FOR UPDATE`;
        const pet = await tx.userPet.findUniqueOrThrow({ where: { id: created.id } });

        const last = await tx.petCareAction.findFirst({
          where: { petId: pet.id, type },
          orderBy: { createdAt: 'desc' },
        });
        const availableAt = cooldownEndsAt(type, last?.createdAt);
        if (availableAt) {
          throw new AppException(
            HttpStatus.TOO_MANY_REQUESTS,
            ErrorCode.CARE_COOLDOWN,
            `${pet.name} одоохондоо амарч байна. Түр хүлээгээд дахин оролдоорой.`,
            { availableAt: availableAt.toISOString() },
          );
        }

        const rule = CARE_RULES[type];
        const now = new Date();
        const happinessBefore = effectiveHappiness(pet.happiness, pet.happinessUpdatedAt, now);
        const happinessAfter = addHappiness(happinessBefore, rule.happiness);
        const profile = await tx.userProfile.findUnique({ where: { userId } });

        const action = await tx.petCareAction.create({
          data: {
            petId: pet.id,
            userId,
            type,
            localDate: toDbDate(localDateString(profile?.timezone ?? 'Asia/Ulaanbaatar')),
            xpAwarded: rule.xp,
            happinessDelta: happinessAfter - happinessBefore,
            idempotencyKey,
          },
        });
        const progress = await this.ledger.postPet(tx, pet.id, {
          kind: 'EARN',
          amount: rule.xp,
          sourceType: 'PET_CARE',
          sourceId: action.id,
          idempotencyKey: `care:${action.id}`,
          actorId: userId,
          metadata: { careType: type },
        });
        await tx.userPet.update({
          where: { id: pet.id },
          data: { happiness: happinessAfter, happinessUpdatedAt: now, lastCaredAt: now },
        });

        const achievements = await this.achievements.evaluate(tx, userId);
        const accessories = await this.syncUnlocks(tx, userId, pet.id);
        const questsCompleted = await this.quests.refreshForUser(tx, userId);

        return {
          type,
          petXP: rule.xp,
          happinessDelta: happinessAfter - happinessBefore,
          replayed: false,
          leveledUp: progress?.leveledUp ?? false,
          pet: await this.toDto(tx, pet.id),
          accessoriesUnlocked: accessories,
          questsCompleted,
          achievementsUnlocked: achievements.map((a) => ({
            id: a.id,
            key: a.key,
            title: a.title,
            description: a.description,
            icon: a.icon,
            xpReward: a.xpReward,
          })),
        };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const concurrent = await this.findCareReplay(userId, idempotencyKey);
        if (concurrent) return concurrent;
      }
      throw err;
    }
  }

  async listAccessories(userId: string): Promise<AccessoryDto[]> {
    const pet = await this.prisma.$transaction(async (tx) => {
      const p = await this.ensurePet(tx, userId);
      await this.syncUnlocks(tx, userId, p.id);
      return p;
    });
    const [catalog, owned, context] = await Promise.all([
      this.prisma.petAccessory.findMany({
        where: { isActive: true },
        include: { achievement: { select: { title: true } } },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.userPetAccessory.findMany({ where: { petId: pet.id } }),
      this.unlockContext(this.prisma, userId, pet.id),
    ]);
    const ownedBy = new Map(owned.map((o) => [o.accessoryId, o]));
    return catalog.map((a) => {
      const own = ownedBy.get(a.id);
      return {
        id: a.id,
        key: a.key,
        name: a.name,
        slot: a.slot,
        rarity: a.rarity,
        assetKey: a.assetKey,
        unlockType: a.unlockType,
        requirement: this.requirementLabel(a, a.achievement?.title),
        progress: own ? 1 : this.unlockProgress(a, context),
        unlocked: Boolean(own),
        equipped: Boolean(own?.equippedSlot),
        unlockedAt: own?.unlockedAt.toISOString() ?? null,
      };
    });
  }

  async equip(userId: string, accessoryId: string): Promise<PetDto> {
    const petId = await this.prisma.$transaction(async (tx) => {
      const pet = await this.ensurePet(tx, userId);
      const owned = await this.findOwned(tx, pet.id, accessoryId);
      // One item per slot: free the slot first, then equip (unique (petId, equippedSlot)).
      await tx.userPetAccessory.updateMany({
        where: { petId: pet.id, equippedSlot: owned.accessory.slot },
        data: { equippedSlot: null, equippedAt: null },
      });
      await tx.userPetAccessory.update({
        where: { id: owned.id },
        data: { equippedSlot: owned.accessory.slot, equippedAt: new Date() },
      });
      return pet.id;
    });
    return this.toDto(this.prisma, petId);
  }

  async unequip(userId: string, accessoryId: string): Promise<PetDto> {
    const petId = await this.prisma.$transaction(async (tx) => {
      const pet = await this.ensurePet(tx, userId);
      const owned = await this.findOwned(tx, pet.id, accessoryId);
      await tx.userPetAccessory.update({
        where: { id: owned.id },
        data: { equippedSlot: null, equippedAt: null },
      });
      return pet.id;
    });
    return this.toDto(this.prisma, petId);
  }

  async history(userId: string, query: PetHistoryQueryDto): Promise<Paginated<PetHistoryItemDto>> {
    const pet = await this.prisma.userPet.findUnique({ where: { userId } });
    if (!pet) return new Paginated([], 0, query);
    const where = { walletType: 'PET' as const, petId: pet.id };
    const [rows, total] = await Promise.all([
      this.prisma.xPTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.xPTransaction.count({ where }),
    ]);
    return new Paginated(
      rows.map((t) => {
        const meta = (t.metadata ?? {}) as { careType?: PetCareType; habitTitle?: string };
        const title =
          t.sourceType === 'PET_CARE' && meta.careType
            ? CARE_LABELS[meta.careType]
            : t.sourceType === 'COMPLETION_REVERSAL'
              ? `${meta.habitTitle ?? 'Дадал'} — буцаасан`
              : t.sourceType === 'HABIT_COMPLETION'
                ? `${meta.habitTitle ?? 'Дадал'} биелүүлсэн`
                : 'Залруулга';
        return { id: t.id, amount: t.amount, title, createdAt: t.createdAt.toISOString() };
      }),
      total,
      query,
    );
  }

  // ───────────────────────────── Used by the completion engine ─────────────────────────────

  /** Pet XP + a little happiness for a habit completion (inside the completion transaction). */
  async awardForCompletion(
    tx: PrismaTx,
    userId: string,
    completionId: string,
    xp: number,
    metadata: Prisma.InputJsonValue,
  ): Promise<PetProgressDto> {
    const pet = await this.ensurePet(tx, userId);
    const progress = await this.ledger.postPet(tx, pet.id, {
      kind: 'EARN',
      amount: xp,
      sourceType: 'HABIT_COMPLETION',
      sourceId: completionId,
      idempotencyKey: `completion:${completionId}:PET`,
      actorId: userId,
      metadata,
    });
    const now = new Date();
    const happiness = addHappiness(
      effectiveHappiness(pet.happiness, pet.happinessUpdatedAt, now),
      COMPLETION_HAPPINESS,
    );
    await tx.userPet.update({
      where: { id: pet.id },
      data: { happiness, happinessUpdatedAt: now },
    });
    const state = progress ?? {
      ...levelFromXp(pet.lifetimeXP),
      lifetimeXP: pet.lifetimeXP,
      leveledUp: false,
    };
    return {
      level: state.level,
      lifetimeXP: state.lifetimeXP,
      xpIntoLevel: state.xpIntoLevel,
      xpForNextLevel: state.xpForNextLevel,
      happiness,
      leveledUp: state.leveledUp,
    };
  }

  /** Creates the pet on first use, with the DEFAULT accessories. */
  async ensurePet(tx: PrismaTx, userId: string): Promise<UserPet> {
    const existing = await tx.userPet.findUnique({ where: { userId } });
    if (existing) return existing;
    await tx.userPet.createMany({ data: [{ userId }], skipDuplicates: true });
    return tx.userPet.findUniqueOrThrow({ where: { userId } });
  }

  /** Unlocks every accessory whose condition is now met. Never removes one. */
  async syncUnlocks(tx: PrismaTx, userId: string, petId: string): Promise<AccessoryUnlockDto[]> {
    const catalog = await tx.petAccessory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const owned = await tx.userPetAccessory.findMany({
      where: { petId },
      select: { accessoryId: true },
    });
    const context = await this.unlockContext(tx, userId, petId);
    const have = new Set(owned.map((o) => o.accessoryId));
    const due = catalog.filter((a) => !have.has(a.id) && this.unlockProgress(a, context) >= 1);
    if (due.length === 0) return [];
    await tx.userPetAccessory.createMany({
      data: due.map((a) => ({ petId, accessoryId: a.id })),
      skipDuplicates: true,
    });
    return due.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      slot: a.slot,
      rarity: a.rarity,
      assetKey: a.assetKey,
    }));
  }

  // ───────────────────────────── Internals ─────────────────────────────

  private async unlockContext(db: PrismaTx, userId: string, petId: string) {
    // Sequential: `db` may be a transaction client (one connection, no overlapping queries).
    const pet = await db.userPet.findUniqueOrThrow({
      where: { id: petId },
      select: { level: true },
    });
    const g = await db.userGamification.findUnique({
      where: { userId },
      select: { lifetimeXP: true },
    });
    const achievements = await db.userAchievement.findMany({
      where: { userId },
      select: { achievementId: true },
    });
    return {
      petLevel: pet.level,
      userLevel: levelFromXp(g?.lifetimeXP ?? 0).level,
      achievementIds: new Set(achievements.map((a) => a.achievementId)),
    };
  }

  private unlockProgress(
    a: PetAccessory,
    ctx: { petLevel: number; userLevel: number; achievementIds: Set<string> },
  ): number {
    const ratio = (have: number, need: number | null) =>
      Math.min(1, need && need > 0 ? have / need : 1);
    switch (a.unlockType) {
      case 'DEFAULT':
        return 1;
      case 'PET_LEVEL':
        return ratio(ctx.petLevel, a.unlockValue);
      case 'USER_LEVEL':
        return ratio(ctx.userLevel, a.unlockValue);
      case 'ACHIEVEMENT':
        return a.achievementId && ctx.achievementIds.has(a.achievementId) ? 1 : 0;
    }
  }

  private requirementLabel(a: PetAccessory, achievementTitle?: string): string {
    switch (a.unlockType) {
      case 'DEFAULT':
        return 'Анхнаасаа';
      case 'PET_LEVEL':
        return `Pet ${a.unlockValue}-р түвшин`;
      case 'USER_LEVEL':
        return `Таны ${a.unlockValue}-р түвшин`;
      case 'ACHIEVEMENT':
        return `«${achievementTitle ?? 'Амжилт'}» амжилт`;
    }
  }

  private async findOwned(tx: PrismaTx, petId: string, accessoryId: string) {
    const accessory = await tx.petAccessory.findFirst({
      where: { id: accessoryId, isActive: true },
    });
    if (!accessory) {
      throw AppException.notFound(ErrorCode.ACCESSORY_NOT_FOUND, 'Чимэглэл олдсонгүй.');
    }
    const owned = await tx.userPetAccessory.findUnique({
      where: { petId_accessoryId: { petId, accessoryId } },
    });
    if (!owned) {
      throw AppException.forbidden(
        ErrorCode.ACCESSORY_LOCKED,
        'Энэ чимэглэл хараахан нээгдээгүй байна.',
      );
    }
    return { ...owned, accessory };
  }

  private async findCareReplay(
    userId: string,
    idempotencyKey: string,
  ): Promise<CareResultDto | null> {
    const action = await this.prisma.petCareAction.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
    if (!action) return null;
    return {
      type: action.type,
      petXP: action.xpAwarded,
      happinessDelta: action.happinessDelta,
      replayed: true,
      leveledUp: false,
      pet: await this.toDto(this.prisma, action.petId),
      accessoriesUnlocked: [],
      questsCompleted: [],
      achievementsUnlocked: [] as AchievementUnlockDto[],
    };
  }

  private async toDto(db: PrismaTx, petId: string): Promise<PetDto> {
    const pet = await db.userPet.findUniqueOrThrow({
      where: { id: petId },
      include: { accessories: { include: { accessory: true } } },
    });
    const lastByType = await db.petCareAction.groupBy({
      by: ['type'],
      where: { petId },
      _max: { createdAt: true },
    });
    const total = await db.petAccessory.count({ where: { isActive: true } });
    const lastOf = new Map(lastByType.map((r) => [r.type, r._max.createdAt]));
    const happiness = effectiveHappiness(pet.happiness, pet.happinessUpdatedAt);
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      ...levelFromXp(pet.lifetimeXP),
      lifetimeXP: pet.lifetimeXP,
      happiness,
      mood: moodOf(happiness),
      lastCaredAt: pet.lastCaredAt?.toISOString() ?? null,
      care: CARE_TYPES.map((type) => ({
        type,
        ...CARE_RULES[type],
        availableAt: cooldownEndsAt(type, lastOf.get(type))?.toISOString() ?? null,
      })),
      equipped: pet.accessories
        .filter((a) => a.equippedSlot)
        .map((a) => ({
          id: a.accessory.id,
          key: a.accessory.key,
          name: a.accessory.name,
          slot: a.accessory.slot,
          assetKey: a.accessory.assetKey,
        })),
      accessoriesUnlocked: pet.accessories.length,
      accessoriesTotal: total,
    };
  }
}
