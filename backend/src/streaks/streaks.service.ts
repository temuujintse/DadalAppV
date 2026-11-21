import { Injectable } from '@nestjs/common';
import { fromDbDate, toDbDate } from '../common/utils/local-date';
import { PrismaTx } from '../database/prisma.service';
import { computeStreak, StreakResult } from './streak-calculator';

export interface StreakHabit {
  id: string;
  familyId: string | null;
  completionMode: 'PER_MEMBER' | 'SHARED' | null;
  startDate: Date;
  endDate: Date | null;
  scheduleDays: { weekday: number }[];
}

/**
 * Persists streaks. Always recomputed from completion history inside the caller's transaction,
 * so completions and undos can never leave a stale or double-counted streak.
 */
@Injectable()
export class StreaksService {
  /**
   * @param userId owner of the streak; ignored for SHARED family habits (streak is family-level).
   */
  async recalculate(
    tx: PrismaTx,
    habit: StreakHabit,
    userId: string,
    today: string,
  ): Promise<StreakResult> {
    const shared = habit.completionMode === 'SHARED';
    const rows = await tx.habitCompletion.findMany({
      where: shared ? { habitId: habit.id, userId: null } : { habitId: habit.id, userId },
      select: { localDate: true },
    });

    const result = computeStreak({
      completedDates: rows.map((r) => fromDbDate(r.localDate)),
      scheduleDays: habit.scheduleDays.map((d) => d.weekday),
      startDate: fromDbDate(habit.startDate),
      endDate: habit.endDate ? fromDbDate(habit.endDate) : null,
      today,
    });

    const data = {
      currentStreak: result.current,
      longestStreak: result.longest,
      lastCompletedDate: result.lastCompletedDate ? toDbDate(result.lastCompletedDate) : null,
    };

    if (shared) {
      await tx.familyHabitStreak.upsert({
        where: { habitId: habit.id },
        create: { habitId: habit.id, familyId: habit.familyId!, ...data },
        update: data,
      });
    } else {
      await tx.habitStreak.upsert({
        where: { habitId_userId: { habitId: habit.id, userId } },
        create: { habitId: habit.id, userId, ...data },
        update: data,
      });
    }
    return result;
  }
}
