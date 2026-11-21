import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService, PrismaTx } from '../database/prisma.service';
import { Family, FamilyMember } from '../generated/prisma/client';
import { can, FamilyPermission } from './family-policy';

export type MembershipWithFamily = FamilyMember & { family: Family };

/**
 * Resolves the caller's family strictly from the database (never from client input).
 * Every family-scoped query in the codebase must start here → family data isolation.
 */
@Injectable()
export class FamilyAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async findMembership(userId: string, tx?: PrismaTx): Promise<MembershipWithFamily | null> {
    const membership = await (tx ?? this.prisma).familyMember.findUnique({
      where: { userId },
      include: { family: true },
    });
    if (!membership || membership.family.deletedAt) return null;
    return membership;
  }

  async requireMembership(userId: string, tx?: PrismaTx): Promise<MembershipWithFamily> {
    const membership = await this.findMembership(userId, tx);
    if (!membership) {
      throw AppException.notFound(ErrorCode.NOT_IN_FAMILY, 'Та одоогоор гэр бүлд нэгдээгүй байна.');
    }
    return membership;
  }

  async requirePermission(
    userId: string,
    permission: FamilyPermission,
    tx?: PrismaTx,
  ): Promise<MembershipWithFamily> {
    const membership = await this.requireMembership(userId, tx);
    if (!can(membership.role, permission)) {
      throw AppException.forbidden(ErrorCode.FORBIDDEN, 'Танд энэ үйлдлийг хийх эрх алга.');
    }
    return membership;
  }
}
