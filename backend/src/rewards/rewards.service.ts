import { Injectable } from '@nestjs/common';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService, PrismaTx } from '../database/prisma.service';
import { FamilyAccessService, MembershipWithFamily } from '../families/family-access.service';
import { can, FamilyPermission } from '../families/family-policy';
import { XpLedgerService } from '../gamification/xp-ledger.service';
import { Prisma, RedemptionStatus } from '../generated/prisma/client';
import {
  CreateRewardDto,
  ListRedemptionsQueryDto,
  RedemptionDecisionResultDto,
  RedemptionDto,
  RewardDto,
  UpdateRewardDto,
} from './dto/reward.dto';

const PROFILE = { select: { displayName: true, avatarKey: true } } as const;

const REDEMPTION_INCLUDE = {
  reward: { select: { id: true, title: true, icon: true } },
  user: { select: { id: true, profile: PROFILE } },
  decidedBy: { select: { id: true, profile: PROFILE } },
} satisfies Prisma.RewardRedemptionInclude;

type RedemptionRow = Prisma.RewardRedemptionGetPayload<{ include: typeof REDEMPTION_INCLUDE }>;

/**
 * Family-internal rewards (spec ch. 5.6). Lifecycle: PENDING → APPROVED → REDEEMED, or
 * REJECTED / CANCELLED. XP is spent exactly once — on approval — through the XP ledger
 * (idempotency key `redemption:<id>:spend`). Spending lowers the balance, never the level.
 */
@Injectable()
export class RewardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly ledger: XpLedgerService,
    private readonly audit: AuditService,
  ) {}

  // ───────────────────────────── Catalog ─────────────────────────────

  async list(userId: string): Promise<RewardDto[]> {
    const membership = await this.access.requireMembership(userId);
    const manager = can(membership.role, FamilyPermission.MANAGE_REWARDS);
    const [rewards, available] = await Promise.all([
      this.prisma.reward.findMany({
        where: {
          familyId: membership.familyId,
          deletedAt: null,
          ...(manager ? {} : { isActive: true }),
        },
        include: { createdBy: { select: { id: true, profile: PROFILE } } },
        orderBy: [{ isActive: 'desc' }, { xpCost: 'asc' }],
      }),
      this.availableXp(this.prisma, userId),
    ]);
    return rewards.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      icon: r.icon,
      xpCost: r.xpCost,
      isActive: r.isActive,
      createdBy: this.person(r.createdBy),
      createdAt: r.createdAt.toISOString(),
      availableXP: available,
      canRedeem: r.isActive && available >= r.xpCost,
    }));
  }

  async create(userId: string, dto: CreateRewardDto): Promise<RewardDto[]> {
    const membership = await this.access.requirePermission(userId, FamilyPermission.MANAGE_REWARDS);
    await this.prisma.$transaction(async (tx) => {
      const reward = await tx.reward.create({
        data: {
          familyId: membership.familyId,
          createdById: userId,
          title: dto.title,
          description: dto.description || null,
          icon: dto.icon ?? 'gift',
          xpCost: dto.xpCost,
        },
      });
      await this.audit.record(
        {
          action: AuditAction.REWARD_CREATED,
          entityType: 'Reward',
          entityId: reward.id,
          familyId: membership.familyId,
          actorId: userId,
          metadata: { xpCost: dto.xpCost },
        },
        tx,
      );
    });
    return this.list(userId);
  }

  async update(userId: string, rewardId: string, dto: UpdateRewardDto): Promise<RewardDto[]> {
    const membership = await this.access.requirePermission(userId, FamilyPermission.MANAGE_REWARDS);
    await this.prisma.$transaction(async (tx) => {
      await this.findReward(tx, membership.familyId, rewardId);
      // Pending requests keep their cost snapshot; only new requests use the new price.
      await tx.reward.update({
        where: { id: rewardId },
        data: {
          title: dto.title,
          description: dto.description === undefined ? undefined : dto.description || null,
          icon: dto.icon,
          xpCost: dto.xpCost,
          isActive: dto.isActive,
        },
      });
      await this.audit.record(
        {
          action: AuditAction.REWARD_UPDATED,
          entityType: 'Reward',
          entityId: rewardId,
          familyId: membership.familyId,
          actorId: userId,
          metadata: { fields: Object.keys(dto) },
        },
        tx,
      );
    });
    return this.list(userId);
  }

  /** Soft delete. Pending requests are cancelled (no XP was taken from anyone). */
  async remove(userId: string, rewardId: string): Promise<null> {
    const membership = await this.access.requirePermission(userId, FamilyPermission.MANAGE_REWARDS);
    await this.prisma.$transaction(async (tx) => {
      await this.findReward(tx, membership.familyId, rewardId);
      await tx.reward.update({
        where: { id: rewardId },
        data: { deletedAt: new Date(), isActive: false },
      });
      await tx.rewardRedemption.updateMany({
        where: { rewardId, status: 'PENDING' },
        data: { status: 'CANCELLED', decisionNote: 'Шагналыг устгасан', decidedAt: new Date() },
      });
      await this.audit.record(
        {
          action: AuditAction.REWARD_DELETED,
          entityType: 'Reward',
          entityId: rewardId,
          familyId: membership.familyId,
          actorId: userId,
        },
        tx,
      );
    });
    return null;
  }

  // ───────────────────────────── Redemptions ─────────────────────────────

  async redeem(
    userId: string,
    rewardId: string,
    idempotencyKey: string,
    note?: string,
  ): Promise<RedemptionDto> {
    const membership = await this.access.requireMembership(userId);
    const replay = await this.prisma.rewardRedemption.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
      include: REDEMPTION_INCLUDE,
    });
    const managers = await this.managerCount(this.prisma, membership.familyId);
    if (replay) return this.toDto(replay, userId, membership, managers);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        // Serialise a member's requests so two quick taps cannot over-commit their XP.
        await tx.$queryRaw`SELECT "userId" FROM "UserGamification" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
        const reward = await this.findReward(tx, membership.familyId, rewardId);
        if (!reward.isActive) {
          throw AppException.conflict(
            ErrorCode.REWARD_NOT_FOUND,
            'Энэ шагнал одоогоор идэвхгүй байна.',
          );
        }
        const available = await this.availableXp(tx, userId);
        if (available < reward.xpCost) {
          throw AppException.conflict(
            ErrorCode.INSUFFICIENT_XP,
            `XP хүрэлцэхгүй байна. Дахиад ${reward.xpCost - available} XP цуглуулаарай!`,
            { available, required: reward.xpCost },
          );
        }
        const redemption = await tx.rewardRedemption.create({
          data: {
            rewardId,
            familyId: membership.familyId,
            userId,
            xpCost: reward.xpCost,
            note: note || null,
            idempotencyKey,
          },
          include: REDEMPTION_INCLUDE,
        });
        await this.audit.record(
          {
            action: AuditAction.REDEMPTION_REQUESTED,
            entityType: 'RewardRedemption',
            entityId: redemption.id,
            familyId: membership.familyId,
            actorId: userId,
            metadata: { rewardId, xpCost: reward.xpCost },
          },
          tx,
        );
        return redemption;
      });
      return this.toDto(created, userId, membership, managers);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const again = await this.prisma.rewardRedemption.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
          include: REDEMPTION_INCLUDE,
        });
        if (again) return this.toDto(again, userId, membership, managers);
      }
      throw err;
    }
  }

  async listRedemptions(userId: string, query: ListRedemptionsQueryDto): Promise<RedemptionDto[]> {
    const membership = await this.access.requireMembership(userId);
    if (query.scope === 'family' && !can(membership.role, FamilyPermission.DECIDE_REDEMPTIONS)) {
      throw AppException.forbidden(ErrorCode.FORBIDDEN, 'Танд энэ үйлдлийг хийх эрх алга.');
    }
    const [rows, managers] = await Promise.all([
      this.prisma.rewardRedemption.findMany({
        where: {
          familyId: membership.familyId,
          ...(query.scope === 'mine' ? { userId } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        include: REDEMPTION_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.managerCount(this.prisma, membership.familyId),
    ]);
    return rows.map((r) => this.toDto(r, userId, membership, managers));
  }

  async approve(userId: string, id: string, note?: string): Promise<RedemptionDecisionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const { membership, row } = await this.loadForDecision(tx, userId, id);
      await this.transition(tx, row.id, 'PENDING', {
        status: 'APPROVED',
        decidedById: userId,
        decidedAt: new Date(),
        decisionNote: note || null,
      });
      const wallet = await this.ledger.personalState(tx, row.userId);
      if (wallet.balanceXP < row.xpCost) {
        throw AppException.conflict(
          ErrorCode.INSUFFICIENT_XP,
          'Хүсэлт гаргасан гишүүнд хангалттай XP үлдээгүй байна.',
          { available: wallet.balanceXP, required: row.xpCost },
        );
      }
      const after = await this.ledger.postPersonal(tx, row.userId, {
        kind: 'SPEND',
        amount: -row.xpCost,
        sourceType: 'REWARD_REDEMPTION',
        sourceId: row.id,
        idempotencyKey: `redemption:${row.id}:spend`,
        actorId: userId,
        metadata: { rewardId: row.rewardId, title: row.reward.title },
      });
      await this.audit.record(
        {
          action: AuditAction.REDEMPTION_APPROVED,
          entityType: 'RewardRedemption',
          entityId: row.id,
          familyId: membership.familyId,
          actorId: userId,
          metadata: { requesterId: row.userId, xpCost: row.xpCost },
        },
        tx,
      );
      return {
        redemption: await this.reload(tx, row.id, userId, membership),
        requesterWallet: after ?? { ...wallet, leveledUp: false },
      };
    });
  }

  async reject(userId: string, id: string, note?: string): Promise<RedemptionDecisionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const { membership, row } = await this.loadForDecision(tx, userId, id);
      await this.transition(tx, row.id, 'PENDING', {
        status: 'REJECTED',
        decidedById: userId,
        decidedAt: new Date(),
        decisionNote: note || null,
      });
      await this.audit.record(
        {
          action: AuditAction.REDEMPTION_REJECTED,
          entityType: 'RewardRedemption',
          entityId: row.id,
          familyId: membership.familyId,
          actorId: userId,
        },
        tx,
      );
      return {
        redemption: await this.reload(tx, row.id, userId, membership),
        requesterWallet: null,
      };
    });
  }

  /** Approved reward was actually handed over. */
  async complete(userId: string, id: string): Promise<RedemptionDecisionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.access.requirePermission(
        userId,
        FamilyPermission.DECIDE_REDEMPTIONS,
        tx,
      );
      const row = await this.findRedemption(tx, membership.familyId, id);
      await this.transition(tx, row.id, 'APPROVED', { status: 'REDEEMED', redeemedAt: new Date() });
      await this.audit.record(
        {
          action: AuditAction.REDEMPTION_COMPLETED,
          entityType: 'RewardRedemption',
          entityId: row.id,
          familyId: membership.familyId,
          actorId: userId,
        },
        tx,
      );
      return {
        redemption: await this.reload(tx, row.id, userId, membership),
        requesterWallet: null,
      };
    });
  }

  /** Requester withdraws their own pending request (nothing was spent yet). */
  async cancel(userId: string, id: string): Promise<RedemptionDecisionResultDto> {
    return this.prisma.$transaction(async (tx) => {
      const membership = await this.access.requireMembership(userId, tx);
      const row = await this.findRedemption(tx, membership.familyId, id);
      if (row.userId !== userId) {
        throw AppException.notFound(ErrorCode.REDEMPTION_NOT_FOUND, 'Хүсэлт олдсонгүй.');
      }
      await this.transition(tx, row.id, 'PENDING', { status: 'CANCELLED', decidedAt: new Date() });
      await this.audit.record(
        {
          action: AuditAction.REDEMPTION_CANCELLED,
          entityType: 'RewardRedemption',
          entityId: row.id,
          familyId: membership.familyId,
          actorId: userId,
        },
        tx,
      );
      return {
        redemption: await this.reload(tx, row.id, userId, membership),
        requesterWallet: null,
      };
    });
  }

  // ───────────────────────────── Helpers ─────────────────────────────

  private managerCount(db: PrismaTx, familyId: string): Promise<number> {
    return db.familyMember.count({ where: { familyId, role: { in: ['OWNER', 'PARENT'] } } });
  }

  /** Balance minus the user's own pending requests — what they can still ask for. */
  private async availableXp(db: PrismaTx, userId: string): Promise<number> {
    // Sequential: `db` may be a transaction client.
    const wallet = await db.userGamification.findUnique({
      where: { userId },
      select: { balanceXP: true },
    });
    const pending = await db.rewardRedemption.aggregate({
      where: { userId, status: 'PENDING' },
      _sum: { xpCost: true },
    });
    return Math.max(0, (wallet?.balanceXP ?? 0) - (pending._sum.xpCost ?? 0));
  }

  private async findReward(tx: PrismaTx, familyId: string, rewardId: string) {
    const reward = await tx.reward.findFirst({
      where: { id: rewardId, familyId, deletedAt: null },
    });
    if (!reward) throw AppException.notFound(ErrorCode.REWARD_NOT_FOUND, 'Шагнал олдсонгүй.');
    return reward;
  }

  private async findRedemption(tx: PrismaTx, familyId: string, id: string): Promise<RedemptionRow> {
    const row = await tx.rewardRedemption.findFirst({
      where: { id, familyId },
      include: REDEMPTION_INCLUDE,
    });
    if (!row) throw AppException.notFound(ErrorCode.REDEMPTION_NOT_FOUND, 'Хүсэлт олдсонгүй.');
    return row;
  }

  /**
   * OWNER/PARENT decide. Nobody decides their own request unless they are the family's only
   * manager (otherwise a parent could approve their own rewards).
   */
  private async loadForDecision(tx: PrismaTx, userId: string, id: string) {
    const membership = await this.access.requirePermission(
      userId,
      FamilyPermission.DECIDE_REDEMPTIONS,
      tx,
    );
    const row = await this.findRedemption(tx, membership.familyId, id);
    if (row.userId === userId) {
      const managers = await this.managerCount(tx, membership.familyId);
      if (managers > 1) {
        throw AppException.forbidden(
          ErrorCode.CANNOT_DECIDE_OWN,
          'Өөрийн хүсэлтийг гэр бүлийн өөр эцэг эх шийдвэрлэнэ.',
        );
      }
    }
    return { membership, row };
  }

  /** Compare-and-swap status change: a request can be decided exactly once. */
  private async transition(
    tx: PrismaTx,
    id: string,
    from: RedemptionStatus,
    data: Prisma.RewardRedemptionUncheckedUpdateManyInput,
  ): Promise<void> {
    const res = await tx.rewardRedemption.updateMany({ where: { id, status: from }, data });
    if (res.count !== 1) {
      throw AppException.conflict(
        ErrorCode.REDEMPTION_INVALID_STATE,
        'Энэ хүсэлтийг аль хэдийн шийдвэрлэсэн байна.',
      );
    }
  }

  private async reload(
    tx: PrismaTx,
    id: string,
    userId: string,
    membership: MembershipWithFamily,
  ): Promise<RedemptionDto> {
    const row = await tx.rewardRedemption.findUniqueOrThrow({
      where: { id },
      include: REDEMPTION_INCLUDE,
    });
    return this.toDto(row, userId, membership, await this.managerCount(tx, membership.familyId));
  }

  private toDto(
    r: RedemptionRow,
    userId: string,
    membership: MembershipWithFamily,
    managerCount = 1,
  ): RedemptionDto {
    const manager = can(membership.role, FamilyPermission.DECIDE_REDEMPTIONS);
    // Mirrors loadForDecision: your own request is decided by another manager when there is one.
    const mayDecide = manager && (r.userId !== userId || managerCount <= 1);
    return {
      id: r.id,
      reward: { id: r.reward.id, title: r.reward.title, icon: r.reward.icon },
      xpCost: r.xpCost,
      status: r.status,
      note: r.note,
      decisionNote: r.decisionNote,
      requester: this.person(r.user),
      decidedBy: r.decidedBy ? this.person(r.decidedBy) : null,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      redeemedAt: r.redeemedAt?.toISOString() ?? null,
      canDecide: mayDecide && r.status === 'PENDING',
      canCancel: r.userId === userId && r.status === 'PENDING',
      canComplete: manager && r.status === 'APPROVED',
    };
  }

  private person(u: { id: string; profile: { displayName: string; avatarKey: string } | null }) {
    return {
      userId: u.id,
      displayName: u.profile?.displayName ?? '—',
      avatarKey: u.profile?.avatarKey ?? 'fox',
    };
  }
}
