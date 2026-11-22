import { Injectable } from '@nestjs/common';
import { addDays, fromDbDate, toDbDate } from '../../common/utils/local-date';
import { DEFAULT_TIMEZONE, localDateString } from '../../common/utils/timezone.util';
import { PrismaService } from '../../database/prisma.service';

export interface CoachContext {
  audience: 'child' | 'adult';
  preferences: {
    goals: string | null;
    availableMinutesPerDay: number | null;
    preferredDifficulty: string | null;
  };
  activeHabits: {
    title: string;
    difficulty: string;
    daysPerWeek: number;
    completionRate30d: number;
    currentStreak: number;
  }[];
  recentlyRejected: string[];
}

const WINDOW_DAYS = 30;
const MAX_HABITS = 15;

/**
 * Minimal context for the coach: habit titles and numbers the backend computed itself.
 * No names, e-mails, family names, tokens or ids reach the model.
 */
@Injectable()
export class CoachContextService {
  constructor(private readonly prisma: PrismaService) {}

  async build(userId: string): Promise<CoachContext> {
    const [profile, membership, pref, rejected] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId }, select: { timezone: true } }),
      this.prisma.familyMember.findUnique({ where: { userId }, select: { role: true } }),
      this.prisma.aIUserPreference.findUnique({ where: { userId } }),
      this.prisma.aIRecommendation.findMany({
        where: { userId, status: 'REJECTED' },
        orderBy: { decidedAt: 'desc' },
        take: 10,
        select: { payload: true },
      }),
    ]);
    const today = localDateString(profile?.timezone ?? DEFAULT_TIMEZONE);
    const from = addDays(today, -(WINDOW_DAYS - 1));

    const habits = await this.prisma.habit.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        assignments: { some: { userId } },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_HABITS,
      include: {
        scheduleDays: { select: { weekday: true } },
        streaks: { where: { userId }, select: { currentStreak: true } },
        completions: {
          where: { completedById: userId, localDate: { gte: toDbDate(from) } },
          select: { localDate: true },
        },
      },
    });

    return {
      audience: membership?.role === 'CHILD' ? 'child' : 'adult',
      preferences: {
        goals: pref?.goals ?? null,
        availableMinutesPerDay: pref?.availableMinutesPerDay ?? null,
        preferredDifficulty: pref?.preferredDifficulty ?? null,
      },
      activeHabits: habits.map((h) => {
        const days = new Set(h.scheduleDays.map((d) => d.weekday));
        const start = fromDbDate(h.startDate) > from ? fromDbDate(h.startDate) : from;
        let scheduled = 0;
        for (let d = start; d <= today; d = addDays(d, 1)) {
          if (days.has(new Date(`${d}T00:00:00Z`).getUTCDay())) scheduled++;
        }
        const done = new Set(h.completions.map((c) => fromDbDate(c.localDate))).size;
        return {
          title: h.title,
          difficulty: h.difficulty,
          daysPerWeek: days.size,
          completionRate30d: scheduled
            ? Math.round((Math.min(done, scheduled) / scheduled) * 100)
            : 0,
          currentStreak: h.streaks[0]?.currentStreak ?? 0,
        };
      }),
      recentlyRejected: rejected
        .map((r) => (r.payload as { title?: unknown }).title)
        .filter((t): t is string => typeof t === 'string'),
    };
  }
}
