import { Injectable } from '@nestjs/common';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { DEFAULT_TIMEZONE } from '../common/utils/timezone.util';
import { PrismaService, PrismaTx } from '../database/prisma.service';
import { Prisma } from '../generated/prisma/client';
import { FamilyRole } from '../generated/prisma/enums';
import {
  ChangeRoleDto,
  CreateFamilyDto,
  FamilyDto,
  FamilyMemberDto,
  LeaveResultDto,
  UpdateFamilyDto,
} from './dto/family.dto';
import { FamilyAccessService, MembershipWithFamily } from './family-access.service';
import { canChangeRole, canRemoveMember, FamilyPermission } from './family-policy';
import { photoUrl } from '../common/utils/photo-url';

const ROLE_ORDER: Record<FamilyRole, number> = { OWNER: 0, PARENT: 1, MEMBER: 2, CHILD: 3 };

@Injectable()
export class FamiliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(userId: string, dto: CreateFamilyDto): Promise<FamilyDto> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const existing = await tx.familyMember.findUnique({
          where: { userId },
          include: { family: { select: { deletedAt: true } } },
        });
        if (existing && !existing.family.deletedAt) {
          throw this.alreadyInFamily();
        }
        if (existing) {
          // Stale membership of a dissolved family — clean it up.
          await tx.familyMember.delete({ where: { id: existing.id } });
        }

        const profile = await tx.userProfile.findUnique({ where: { userId } });
        const family = await tx.family.create({
          data: {
            name: dto.name,
            avatarKey: dto.avatarKey ?? 'home',
            timezone: dto.timezone ?? profile?.timezone ?? DEFAULT_TIMEZONE,
            createdById: userId,
            members: { create: { userId, role: FamilyRole.OWNER } },
            gamification: { create: {} },
          },
        });
        await this.audit.record(
          {
            action: AuditAction.FAMILY_CREATED,
            entityType: 'Family',
            entityId: family.id,
            familyId: family.id,
            actorId: userId,
          },
          tx,
        );
      });
    } catch (err) {
      // FamilyMember.userId is UNIQUE → a concurrent create/join loses here.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw this.alreadyInFamily();
      }
      throw err;
    }
    return this.getCurrent(userId);
  }

  async getCurrent(userId: string): Promise<FamilyDto> {
    const membership = await this.access.requireMembership(userId);
    return this.toFamilyDto(membership);
  }

  async update(userId: string, dto: UpdateFamilyDto): Promise<FamilyDto> {
    const membership = await this.access.requirePermission(userId, FamilyPermission.UPDATE_FAMILY);
    await this.prisma.$transaction(async (tx) => {
      await tx.family.update({
        where: { id: membership.familyId },
        data: {
          name: dto.name,
          avatarKey: dto.avatarKey,
          timezone: dto.timezone,
          leaderboardEnabled: dto.leaderboardEnabled,
        },
      });
      await this.audit.record(
        {
          action: AuditAction.FAMILY_UPDATED,
          entityType: 'Family',
          entityId: membership.familyId,
          familyId: membership.familyId,
          actorId: userId,
          metadata: { fields: Object.keys(dto) },
        },
        tx,
      );
    });
    return this.getCurrent(userId);
  }

  async listMembers(userId: string): Promise<FamilyMemberDto[]> {
    const membership = await this.access.requireMembership(userId);
    const members = await this.prisma.familyMember.findMany({
      where: { familyId: membership.familyId },
      include: {
        user: {
          select: {
            profile: { select: { displayName: true, avatarKey: true, photoUpdatedAt: true } },
          },
        },
      },
    });
    return members
      .sort(
        (a, b) =>
          ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joinedAt.getTime() - b.joinedAt.getTime(),
      )
      .map((m) => ({
        id: m.id,
        userId: m.userId,
        displayName: m.user.profile?.displayName ?? '—',
        avatarKey: m.user.profile?.avatarKey ?? 'fox',
        photoUrl: photoUrl(m.userId, m.user.profile?.photoUpdatedAt),
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
        isMe: m.userId === userId,
      }));
  }

  async changeRole(
    userId: string,
    memberId: string,
    dto: ChangeRoleDto,
  ): Promise<FamilyMemberDto[]> {
    await this.prisma.$transaction(async (tx) => {
      const actor = await this.access.requirePermission(userId, FamilyPermission.CHANGE_ROLES, tx);
      const target = await this.findMemberInFamily(tx, actor.familyId, memberId);
      if (target.userId === userId) {
        throw AppException.badRequest(
          ErrorCode.CANNOT_TARGET_SELF,
          'Өөрийн эрхийг өөрчлөх боломжгүй.',
        );
      }
      if (!canChangeRole(actor.role, target.role, dto.role)) {
        throw AppException.forbidden(ErrorCode.FORBIDDEN, 'Танд энэ үйлдлийг хийх эрх алга.');
      }
      if (target.role === dto.role) return;

      await tx.familyMember.update({ where: { id: target.id }, data: { role: dto.role } });
      await this.audit.record(
        {
          action: AuditAction.MEMBER_ROLE_CHANGED,
          entityType: 'FamilyMember',
          entityId: target.id,
          familyId: actor.familyId,
          actorId: userId,
          metadata: { from: target.role, to: dto.role, userId: target.userId },
        },
        tx,
      );
    });
    return this.listMembers(userId);
  }

  async transferOwnership(userId: string, memberId: string): Promise<FamilyMemberDto[]> {
    await this.prisma.$transaction(
      async (tx) => {
        const actor = await this.access.requirePermission(
          userId,
          FamilyPermission.TRANSFER_OWNERSHIP,
          tx,
        );
        const target = await this.findMemberInFamily(tx, actor.familyId, memberId);
        if (target.userId === userId) {
          throw AppException.badRequest(
            ErrorCode.CANNOT_TARGET_SELF,
            'Та аль хэдийн эзэмшигч байна.',
          );
        }
        if (target.role === 'CHILD') {
          throw AppException.forbidden(
            ErrorCode.FORBIDDEN,
            'Хүүхэд эрхтэй гишүүнд эзэмшигчийн эрх шилжүүлэх боломжгүй.',
          );
        }

        await tx.familyMember.update({
          where: { id: actor.id },
          data: { role: FamilyRole.PARENT },
        });
        await tx.familyMember.update({
          where: { id: target.id },
          data: { role: FamilyRole.OWNER },
        });
        await this.audit.record(
          {
            action: AuditAction.OWNERSHIP_TRANSFERRED,
            entityType: 'Family',
            entityId: actor.familyId,
            familyId: actor.familyId,
            actorId: userId,
            metadata: { fromUserId: userId, toUserId: target.userId },
          },
          tx,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.listMembers(userId);
  }

  /** Removes another member, or — when `memberId` is the caller's own — leaves the family. */
  async removeMember(userId: string, memberId: string): Promise<LeaveResultDto> {
    return this.prisma.$transaction(
      async (tx) => {
        const actor = await this.access.requireMembership(userId, tx);
        const target = await this.findMemberInFamily(tx, actor.familyId, memberId);

        if (target.userId === userId) return this.leave(tx, actor);

        if (!canRemoveMember(actor.role, target.role)) {
          throw AppException.forbidden(ErrorCode.FORBIDDEN, 'Танд энэ гишүүнийг хасах эрх алга.');
        }
        await this.detachMember(tx, actor.familyId, target.id, target.userId);
        await this.audit.record(
          {
            action: AuditAction.MEMBER_REMOVED,
            entityType: 'FamilyMember',
            entityId: target.id,
            familyId: actor.familyId,
            actorId: userId,
            metadata: { userId: target.userId, role: target.role },
          },
          tx,
        );
        return { familyDissolved: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async leave(tx: PrismaTx, actor: MembershipWithFamily): Promise<LeaveResultDto> {
    if (actor.role === FamilyRole.OWNER) {
      const others = await tx.familyMember.count({
        where: { familyId: actor.familyId, NOT: { id: actor.id } },
      });
      if (others > 0) {
        throw AppException.conflict(
          ErrorCode.OWNER_MUST_TRANSFER,
          'Гэр бүлээс гарахаас өмнө эзэмшигчийн эрхээ өөр гишүүнд шилжүүлнэ үү.',
        );
      }
      // Last member leaving → close the family (soft delete keeps history intact).
      await this.detachMember(tx, actor.familyId, actor.id, actor.userId);
      await tx.family.update({ where: { id: actor.familyId }, data: { deletedAt: new Date() } });
      await tx.familyInvite.updateMany({
        where: { familyId: actor.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(
        {
          action: AuditAction.FAMILY_DISSOLVED,
          entityType: 'Family',
          entityId: actor.familyId,
          familyId: actor.familyId,
          actorId: actor.userId,
        },
        tx,
      );
      return { familyDissolved: true };
    }

    await this.detachMember(tx, actor.familyId, actor.id, actor.userId);
    await this.audit.record(
      {
        action: AuditAction.MEMBER_LEFT,
        entityType: 'FamilyMember',
        entityId: actor.id,
        familyId: actor.familyId,
        actorId: actor.userId,
      },
      tx,
    );
    return { familyDissolved: false };
  }

  /** Deletes the membership, its habit assignments and pending reward requests. History stays. */
  private async detachMember(tx: PrismaTx, familyId: string, memberId: string, userId: string) {
    await tx.habitAssignment.deleteMany({ where: { userId, habit: { familyId } } });
    // Pending reward requests die with the membership; nothing was spent yet.
    await tx.rewardRedemption.updateMany({
      where: { userId, familyId, status: 'PENDING' },
      data: { status: 'CANCELLED', decisionNote: 'Гэр бүлээс гарсан', decidedAt: new Date() },
    });
    await tx.familyMember.delete({ where: { id: memberId } });
  }

  private async findMemberInFamily(tx: PrismaTx, familyId: string, memberId: string) {
    // Scoped by familyId → a member id from another family is indistinguishable from "not found".
    const member = await tx.familyMember.findFirst({ where: { id: memberId, familyId } });
    if (!member) {
      throw AppException.notFound(ErrorCode.MEMBER_NOT_FOUND, 'Гишүүн олдсонгүй.');
    }
    return member;
  }

  private async toFamilyDto(membership: MembershipWithFamily): Promise<FamilyDto> {
    const [memberCount, gamification] = await Promise.all([
      this.prisma.familyMember.count({ where: { familyId: membership.familyId } }),
      this.prisma.familyGamification.findUnique({ where: { familyId: membership.familyId } }),
    ]);
    const f = membership.family;
    return {
      id: f.id,
      name: f.name,
      avatarKey: f.avatarKey,
      timezone: f.timezone,
      plan: f.plan,
      createdAt: f.createdAt.toISOString(),
      memberCount,
      myMemberId: membership.id,
      myRole: membership.role,
      leaderboardEnabled: f.leaderboardEnabled,
      gamification: {
        lifetimeXP: gamification?.lifetimeXP ?? 0,
        level: gamification?.level ?? 1,
      },
    };
  }

  private alreadyInFamily() {
    return AppException.conflict(
      ErrorCode.ALREADY_IN_FAMILY,
      'Та аль хэдийн гэр бүлд харьяалагддаг. Нэг хэрэглэгч зөвхөн нэг гэр бүлд байна.',
    );
  }
}
