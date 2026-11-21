import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, AuditService } from '../common/audit/audit.service';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { hmacSha256, normalizeHumanCode, randomHumanCode } from '../common/utils/crypto.util';
import type { Env } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import { FamilyDto } from '../families/dto/family.dto';
import { FamiliesService } from '../families/families.service';
import { FamilyAccessService } from '../families/family-access.service';
import { canInviteAs, FamilyPermission } from '../families/family-policy';
import { Prisma } from '../generated/prisma/client';
import { CreatedInviteDto, CreateInviteDto, InviteDto } from './dto/invite.dto';

const CODE_LENGTH = 10;

@Injectable()
export class InvitesService {
  private readonly secret: string;
  private readonly defaultTtlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly families: FamiliesService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('INVITE_TOKEN_SECRET', { infer: true });
    this.defaultTtlHours = config.get('INVITE_TTL_HOURS', { infer: true });
  }

  /** HMAC (not plain SHA-256) so a leaked table cannot be brute-forced offline. */
  hashCode(normalizedCode: string): string {
    return hmacSha256(this.secret, normalizedCode);
  }

  async create(userId: string, dto: CreateInviteDto): Promise<CreatedInviteDto> {
    const membership = await this.access.requirePermission(userId, FamilyPermission.INVITE_MEMBERS);
    const role = dto.role ?? 'MEMBER';
    if (!canInviteAs(membership.role, role)) {
      throw AppException.forbidden(ErrorCode.FORBIDDEN, 'Энэ эрхтэй гишүүн урих эрх танд алга.');
    }

    const code = randomHumanCode(CODE_LENGTH);
    const expiresAt = new Date(
      Date.now() + (dto.expiresInHours ?? this.defaultTtlHours) * 3600_000,
    );

    const invite = await this.prisma.$transaction(async (tx) => {
      const created = await tx.familyInvite.create({
        data: {
          familyId: membership.familyId,
          createdById: userId,
          tokenHash: this.hashCode(normalizeHumanCode(code)),
          role,
          maxUses: dto.maxUses ?? 1,
          expiresAt,
        },
        include: { createdBy: { select: { profile: { select: { displayName: true } } } } },
      });
      await this.audit.record(
        {
          action: AuditAction.INVITE_CREATED,
          entityType: 'FamilyInvite',
          entityId: created.id,
          familyId: membership.familyId,
          actorId: userId,
          metadata: { role, maxUses: created.maxUses, expiresAt: expiresAt.toISOString() },
        },
        tx,
      );
      return created;
    });

    return { ...this.toDto(invite), code };
  }

  async listActive(userId: string): Promise<InviteDto[]> {
    const membership = await this.access.requirePermission(userId, FamilyPermission.INVITE_MEMBERS);
    const invites = await this.prisma.familyInvite.findMany({
      where: { familyId: membership.familyId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { createdBy: { select: { profile: { select: { displayName: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return invites.filter((i) => i.usedCount < i.maxUses).map((i) => this.toDto(i));
  }

  async revoke(userId: string, inviteId: string): Promise<null> {
    const membership = await this.access.requirePermission(userId, FamilyPermission.INVITE_MEMBERS);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.familyInvite.updateMany({
        where: { id: inviteId, familyId: membership.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (result.count === 0) {
        throw AppException.notFound(ErrorCode.NOT_FOUND, 'Урилга олдсонгүй.');
      }
      await this.audit.record(
        {
          action: AuditAction.INVITE_REVOKED,
          entityType: 'FamilyInvite',
          entityId: inviteId,
          familyId: membership.familyId,
          actorId: userId,
        },
        tx,
      );
    });
    return null;
  }

  async join(userId: string, rawCode: string): Promise<FamilyDto> {
    const normalized = normalizeHumanCode(rawCode);
    if (normalized.length !== CODE_LENGTH) throw this.invalidInvite();
    const tokenHash = this.hashCode(normalized);

    try {
      await this.prisma.$transaction(async (tx) => {
        const invite = await tx.familyInvite.findUnique({
          where: { tokenHash },
          include: { family: true },
        });
        if (!invite || invite.revokedAt || invite.family.deletedAt) throw this.invalidInvite();
        if (invite.expiresAt.getTime() <= Date.now()) {
          throw new AppException(
            HttpStatus.GONE,
            ErrorCode.INVITE_EXPIRED,
            'Урилгын хугацаа дууссан байна. Шинэ урилга авна уу.',
          );
        }
        if (invite.usedCount >= invite.maxUses) throw this.usedUp();

        const existing = await this.access.findMembership(userId, tx);
        if (existing) {
          throw AppException.conflict(
            ErrorCode.ALREADY_IN_FAMILY,
            'Та аль хэдийн гэр бүлд харьяалагддаг. Нэг хэрэглэгч зөвхөн нэг гэр бүлд байна.',
          );
        }
        // A stale membership row of a dissolved family must not block joining.
        await tx.familyMember.deleteMany({ where: { userId } });

        if (invite.family.memberLimit !== null) {
          const count = await tx.familyMember.count({ where: { familyId: invite.familyId } });
          if (count >= invite.family.memberLimit) {
            throw AppException.conflict(
              ErrorCode.FAMILY_FULL,
              'Гэр бүлийн гишүүдийн тоо дүүрсэн байна.',
            );
          }
        }

        // Conditional increment: concurrent joins cannot exceed maxUses.
        const claimed = await tx.familyInvite.updateMany({
          where: { id: invite.id, revokedAt: null, usedCount: { lt: invite.maxUses } },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count !== 1) throw this.usedUp();

        const member = await tx.familyMember.create({
          data: {
            familyId: invite.familyId,
            userId,
            role: invite.role,
            invitedById: invite.createdById,
          },
        });
        await this.audit.record(
          {
            action: AuditAction.MEMBER_JOINED,
            entityType: 'FamilyMember',
            entityId: member.id,
            familyId: invite.familyId,
            actorId: userId,
            metadata: { inviteId: invite.id, role: invite.role },
          },
          tx,
        );
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw AppException.conflict(
          ErrorCode.ALREADY_IN_FAMILY,
          'Та аль хэдийн гэр бүлд харьяалагддаг. Нэг хэрэглэгч зөвхөн нэг гэр бүлд байна.',
        );
      }
      throw err;
    }
    return this.families.getCurrent(userId);
  }

  private toDto(invite: {
    id: string;
    role: InviteDto['role'];
    maxUses: number;
    usedCount: number;
    expiresAt: Date;
    createdAt: Date;
    createdBy: { profile: { displayName: string } | null };
  }): InviteDto {
    return {
      id: invite.id,
      role: invite.role,
      maxUses: invite.maxUses,
      usedCount: invite.usedCount,
      expiresAt: invite.expiresAt.toISOString(),
      createdAt: invite.createdAt.toISOString(),
      createdByName: invite.createdBy.profile?.displayName ?? '—',
    };
  }

  private invalidInvite() {
    return AppException.notFound(
      ErrorCode.INVITE_INVALID,
      'Урилгын код буруу эсвэл хүчингүй байна.',
    );
  }

  private usedUp() {
    return new AppException(
      HttpStatus.GONE,
      ErrorCode.INVITE_USED_UP,
      'Энэ урилгыг ашиглах боломжгүй болсон байна. Шинэ урилга авна уу.',
    );
  }
}
