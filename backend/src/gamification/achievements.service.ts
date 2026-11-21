import { Injectable } from '@nestjs/common';
import { fromDbDate } from '../common/utils/local-date';
import { localDateString } from '../common/utils/timezone.util';
import { PrismaTx } from '../database/prisma.service';
import { Achievement } from '../generated/prisma/client';
import { effectiveStreak } from '../streaks/streak-calculator';
import { isAchieved, UserMetrics } from './achievement-rules';
import { levelFromXp } from './level';
import { XpLedgerService } from './xp-ledger.service';

const STREAK_HABIT_SELECT = {
  habit: {
    select: {
      timezone: true,
      endDate: true,
      deletedAt: true,
      scheduleDays: { select: { weekday: true } },
    },
  },
} as const;

/** Unlocks achievements (once per user) and pays their XP through the ledger. */
@Injectable()
export class AchievementsService {
  constructor(private readonly ledger: XpLedgerService) {}

  /** Recounts completion statistics from history (robust against undo). */
  async refreshActivityStats(tx: PrismaTx, userId: string): Promise<void> {
    const where = { completedById: userId };
    const total = await tx.habitCompletion.count({ where });
    const days = await tx.habitCompletion.groupBy({ by: ['localDate'], where });
    const last = await tx.habitCompletion.findFirst({
      where,
      orderBy: { localDate: 'desc' },
      select: { localDate: true },
    });
    const data = {
      totalCompletions: total,
      completionDays: days.length,
      lastCompletionDate: last?.localDate ?? null,
    };
    await tx.userGamification.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async metrics(db: PrismaTx, userId: string): Promise<UserMetrics> {
    const g = await db.userGamification.findUnique({ where: { userId } });
    const own = await db.habitStreak.findMany({
      where: { userId, habit: { deletedAt: null } },
      include: STREAK_HABIT_SELECT,
    });
    const shared = await db.familyHabitStreak.findMany({
      where: { habit: { deletedAt: null, assignments: { some: { userId } } } },
      include: STREAK_HABIT_SELECT,
    });
    const activeHabits = await db.habit.count({
      where: {
        deletedAt: null,
        status: 'ACTIVE',
        OR: [
          { type: 'PERSONAL', creatorId: userId },
          { type: 'FAMILY', assignments: { some: { userId } } },
        ],
      },
    });
    const membership = await db.familyMember.findUnique({
      where: { userId },
      include: { family: { select: { gamification: { select: { questsCompleted: true } } } } },
    });
    const pet = await db.userPet.findUnique({ where: { userId }, select: { level: true } });

    const bestStreak = Math.max(
      0,
      ...[...own, ...shared].map(
        (s) =>
          effectiveStreak({
            stored: {
              currentStreak: s.currentStreak,
              longestStreak: s.longestStreak,
              lastCompletedDate: s.lastCompletedDate ? fromDbDate(s.lastCompletedDate) : null,
            },
            scheduleDays: s.habit.scheduleDays.map((d) => d.weekday),
            today: localDateString(s.habit.timezone),
            endDate: s.habit.endDate ? fromDbDate(s.habit.endDate) : null,
          }).current,
      ),
    );

    return {
      totalCompletions: g?.totalCompletions ?? 0,
      completionDays: g?.completionDays ?? 0,
      bestStreak,
      activeHabits,
      level: levelFromXp(g?.lifetimeXP ?? 0).level,
      familyQuestsCompleted: membership?.family.gamification?.questsCompleted ?? 0,
      petLevel: pet?.level ?? 0,
    };
  }

  /**
   * Unlocks every newly satisfied achievement and awards its XP. Runs a few rounds because an
   * achievement's XP can raise the level and satisfy a USER_LEVEL achievement.
   */
  async evaluate(tx: PrismaTx, userId: string): Promise<Achievement[]> {
    const unlocked: Achievement[] = [];
    for (let round = 0; round < 3; round++) {
      const owned = await tx.userAchievement.findMany({
        where: { userId },
        select: { achievementId: true },
      });
      const candidates = await tx.achievement.findMany({
        where: { isActive: true, id: { notIn: owned.map((o) => o.achievementId) } },
        orderBy: { sortOrder: 'asc' },
      });
      if (candidates.length === 0) break;

      const m = await this.metrics(tx, userId);
      const due = candidates.filter((a) => isAchieved(a, m));
      if (due.length === 0) break;

      for (const a of due) {
        const created = await tx.userAchievement.createMany({
          data: [{ userId, achievementId: a.id, claimedAt: new Date() }],
          skipDuplicates: true,
        });
        if (created.count === 0) continue;
        await this.ledger.postPersonal(tx, userId, {
          kind: 'EARN',
          amount: a.xpReward,
          sourceType: 'ACHIEVEMENT',
          sourceId: a.id,
          idempotencyKey: `achievement:${a.id}:${userId}`,
          actorId: userId,
          metadata: { achievementKey: a.key, title: a.title },
        });
        unlocked.push(a);
      }
    }
    return unlocked;
  }
}
