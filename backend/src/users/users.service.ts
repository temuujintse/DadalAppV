import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors/app.exception';
import { ErrorCode } from '../common/errors/error-codes';
import { PrismaService } from '../database/prisma.service';
import { MeDto, UpdateMeDto } from './dto/me.dto';
import { photoUrl } from '../common/utils/photo-url';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(userId: string): Promise<MeDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      include: {
        profile: true,
        gamification: true,
        familyMembership: {
          include: {
            family: { select: { id: true, name: true, avatarKey: true, deletedAt: true } },
          },
        },
      },
    });
    if (!user || !user.profile) {
      throw AppException.notFound(ErrorCode.NOT_FOUND, 'Хэрэглэгч олдсонгүй.');
    }

    const membership = user.familyMembership;
    const family =
      membership && !membership.family.deletedAt
        ? {
            id: membership.family.id,
            name: membership.family.name,
            avatarKey: membership.family.avatarKey,
            memberId: membership.id,
            role: membership.role,
          }
        : null;

    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      profile: {
        displayName: user.profile.displayName,
        avatarKey: user.profile.avatarKey,
        photoUrl: photoUrl(user.id, user.profile.photoUpdatedAt),
        timezone: user.profile.timezone,
        locale: user.profile.locale,
        onboardingCompletedAt: user.profile.onboardingCompletedAt?.toISOString() ?? null,
      },
      family,
      gamification: {
        level: user.gamification?.level ?? 1,
        lifetimeXP: user.gamification?.lifetimeXP ?? 0,
        balanceXP: user.gamification?.balanceXP ?? 0,
      },
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<MeDto> {
    const current = await this.prisma.userProfile.findUnique({ where: { userId } });
    if (!current) throw AppException.notFound(ErrorCode.NOT_FOUND, 'Хэрэглэгч олдсонгүй.');

    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        avatarKey: dto.avatarKey,
        timezone: dto.timezone,
        // Onboarding completion is one-way: once set it is never cleared.
        onboardingCompletedAt:
          dto.onboardingCompleted && !current.onboardingCompletedAt ? new Date() : undefined,
      },
    });
    return this.getMe(userId);
  }
}
