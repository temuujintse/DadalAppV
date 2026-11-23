import { Injectable } from '@nestjs/common';
import { Paginated } from '../common/dto/paginated';
import { addDays, weekdayOf } from '../common/utils/local-date';
import { localDateString, zonedMidnightUtc } from '../common/utils/timezone.util';
import { PrismaService } from '../database/prisma.service';
import { FamilyAccessService } from '../families/family-access.service';
import { XPTransaction } from '../generated/prisma/client';
import { achievementProgress } from './achievement-rules';
import { AchievementsService } from './achievements.service';
import {
  AchievementDto,
  FamilyGamificationDto,
  LeaderboardDto,
  LeaderboardPeriod,
  MyGamificationDto,
  TransactionsQueryDto,
  XpTransactionDto,
} from './dto/gamification.dto';
import { levelFromXp } from './level';
import { photoUrl } from '../common/utils/photo-url';

/** Read side of gamification. All writes go through XpLedgerService inside transactions. */
@Injectable()
export class GamificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: FamilyAccessService,
    private readonly achievements: AchievementsService,
  ) {}

  async getMe(userId: string): Promise<MyGamificationDto> {
    const [g, metrics, unlocked, total] = await Promise.all([
      this.prisma.userGamification.findUnique({ where: { userId } }),
      this.achievements.metrics(this.prisma, userId),
      this.prisma.userAchievement.count({ where: { userId } }),
      this.prisma.achievement.count({ where: { isActive: true } }),
    ]);
    const lifetimeXP = g?.lifetimeXP ?? 0;
    return {
      ...levelFromXp(lifetimeXP),
      lifetimeXP,
      balanceXP: g?.balanceXP ?? 0,
      totalCompletions: metrics.totalCompletions,
      completionDays: metrics.completionDays,
      bestStreak: metrics.bestStreak,
      achievementsUnlocked: unlocked,
      achievementsTotal: total,
    };
  }

  async getFamily(userId: string): Promise<FamilyGamificationDto> {
    const membership = await this.access.requireMembership(userId);
    const { family } = membership;
    const [g, week] = await Promise.all([
      this.prisma.familyGamification.findUnique({ where: { familyId: family.id } }),
      this.prisma.xPTransaction.aggregate({
        where: {
          walletType: 'FAMILY',
          familyId: family.id,
          createdAt: { gte: this.periodStart('week', family.timezone)! },
        },
        _sum: { amount: true },
      }),
    ]);
    const lifetimeXP = g?.lifetimeXP ?? 0;
    const { level, xpIntoLevel, xpForNextLevel } = levelFromXp(lifetimeXP);
    return {
      familyId: family.id,
      name: family.name,
      avatarKey: family.avatarKey,
      level,
      lifetimeXP,
      xpIntoLevel,
      xpForNextLevel,
      questsCompleted: g?.questsCompleted ?? 0,
      weekXP: week._sum.amount ?? 0,
      leaderboardEnabled: family.leaderboardEnabled,
    };
  }

  async transactions(
    userId: string,
    query: TransactionsQueryDto,
  ): Promise<Paginated<XpTransactionDto>> {
    const where = { walletType: 'PERSONAL' as const, userId };
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
      rows.map((t) => ({
        id: t.id,
        kind: t.kind,
        amount: t.amount,
        sourceType: t.sourceType,
        title: this.describe(t),
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      query,
    );
  }

  /** In-family ranking of personal XP earned in the period. Never crosses families. */
  async leaderboard(userId: string, period: LeaderboardPeriod): Promise<LeaderboardDto> {
    const { family } = await this.access.requireMembership(userId);
    const start = this.periodStart(period, family.timezone);
    if (!family.leaderboardEnabled) {
      return { period, enabled: false, startsAt: start?.toISOString() ?? null, entries: [] };
    }

    const members = await this.prisma.familyMember.findMany({
      where: { familyId: family.id },
      include: {
        user: {
          select: {
            profile: { select: { displayName: true, avatarKey: true, photoUpdatedAt: true } },
            gamification: { select: { lifetimeXP: true } },
          },
        },
      },
    });
    const sums = await this.prisma.xPTransaction.groupBy({
      by: ['userId'],
      where: {
        walletType: 'PERSONAL',
        userId: { in: members.map((m) => m.userId) },
        kind: { in: ['EARN', 'REVERSAL', 'ADJUSTMENT'] },
        ...(start ? { createdAt: { gte: start } } : {}),
      },
      _sum: { amount: true },
    });
    const xpOf = new Map(sums.map((s) => [s.userId, s._sum.amount ?? 0]));

    const entries = members
      .map((m) => ({
        userId: m.userId,
        displayName: m.user.profile?.displayName ?? '—',
        avatarKey: m.user.profile?.avatarKey ?? 'fox',
        photoUrl: photoUrl(m.userId, m.user.profile?.photoUpdatedAt),
        role: m.role,
        xp: Math.max(0, xpOf.get(m.userId) ?? 0),
        level: levelFromXp(m.user.gamification?.lifetimeXP ?? 0).level,
        isMe: m.userId === userId,
      }))
      .sort((a, b) => b.xp - a.xp || a.displayName.localeCompare(b.displayName));

    // Equal XP → equal rank (1, 2, 2, 4).
    let rank = 0;
    const ranked = entries.map((e, i) => {
      if (i === 0 || e.xp !== entries[i - 1].xp) rank = i + 1;
      return { rank, ...e };
    });
    return { period, enabled: true, startsAt: start?.toISOString() ?? null, entries: ranked };
  }

  async listAchievements(userId: string): Promise<AchievementDto[]> {
    const [all, owned, metrics] = await Promise.all([
      this.prisma.achievement.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
      this.achievements.metrics(this.prisma, userId),
    ]);
    const unlockedAt = new Map(owned.map((o) => [o.achievementId, o.unlockedAt]));
    return all.map((a) => ({
      id: a.id,
      key: a.key,
      title: a.title,
      description: a.description,
      icon: a.icon,
      xpReward: a.xpReward,
      condition: a.condition,
      threshold: a.threshold,
      progress: unlockedAt.has(a.id)
        ? a.threshold
        : Math.min(a.threshold, achievementProgress(a.condition, metrics)),
      unlockedAt: unlockedAt.get(a.id)?.toISOString() ?? null,
    }));
  }

  /** Start of the period in the family's timezone (weeks start on Monday). */
  private periodStart(period: LeaderboardPeriod, timeZone: string): Date | null {
    if (period === 'all') return null;
    const today = localDateString(timeZone);
    const first =
      period === 'week' ? addDays(today, -((weekdayOf(today) + 6) % 7)) : `${today.slice(0, 7)}-01`;
    return zonedMidnightUtc(first, timeZone);
  }

  private describe(t: XPTransaction): string {
    const meta = (t.metadata ?? {}) as { habitTitle?: string; title?: string };
    switch (t.sourceType) {
      case 'HABIT_COMPLETION':
        return meta.habitTitle ?? 'Дадал биелүүлсэн';
      case 'COMPLETION_REVERSAL':
        return `${meta.habitTitle ?? 'Дадал'} — буцаасан`;
      case 'ACHIEVEMENT':
        return `Амжилт: ${meta.title ?? ''}`.trim();
      case 'QUEST':
        return `Даалгавар: ${meta.title ?? ''}`.trim();
      case 'PET_CARE':
        return 'Pet-дээ анхаарал тавьсан';
      case 'REWARD_REDEMPTION':
        return `Шагнал: ${meta.title ?? ''}`.trim();
      case 'ADMIN_ADJUSTMENT':
        return 'Залруулга';
    }
  }
}
