import { addDays, minDate, weekdayOf } from '../common/utils/local-date';

/**
 * Streak rules (spec v1.2, confirmed 2026-11-21):
 * - Counted on the habit's local calendar dates.
 * - Only scheduled weekdays require a completion; unscheduled days never break a streak.
 * - Today does not break the streak while it is still in progress.
 * - One completion per day → a streak grows by at most 1 per day.
 */
export interface StreakInput {
  /** Local dates ("YYYY-MM-DD") that have a completion. */
  completedDates: Iterable<string>;
  /** Scheduled weekdays, 0 = Sunday … 6 = Saturday. */
  scheduleDays: Iterable<number>;
  startDate: string;
  endDate?: string | null;
  today: string;
}

export interface StreakResult {
  current: number;
  longest: number;
  lastCompletedDate: string | null;
}

/** Full recomputation from history (used after every completion and undo). */
export function computeStreak(input: StreakInput): StreakResult {
  const completed = new Set(input.completedDates);
  const scheduled = new Set(input.scheduleDays);
  const last = input.endDate ? minDate(input.today, input.endDate) : input.today;

  let run = 0;
  let longest = 0;
  let lastCompletedDate: string | null = null;

  for (let day = input.startDate; day <= last; day = addDays(day, 1)) {
    const isDone = completed.has(day);
    if (isDone) {
      run += 1;
      longest = Math.max(longest, run);
      lastCompletedDate = day;
    } else if (scheduled.has(weekdayOf(day)) && day !== input.today) {
      // A scheduled day in the past without a completion breaks the streak.
      run = 0;
    }
    // Unscheduled days (and today, while in progress) leave the run untouched.
  }

  return { current: run, longest, lastCompletedDate };
}

/**
 * Read-time check for a stored streak: it is still alive when no scheduled day was missed
 * between the last completion and today (exclusive on both ends).
 */
export function isStreakAlive(params: {
  lastCompletedDate: string | null;
  scheduleDays: Iterable<number>;
  today: string;
  endDate?: string | null;
}): boolean {
  const { lastCompletedDate, today } = params;
  if (!lastCompletedDate) return false;
  if (lastCompletedDate >= today) return true;
  const scheduled = new Set(params.scheduleDays);
  if (scheduled.size === 0) return true;
  const until = params.endDate ? minDate(today, addDays(params.endDate, 1)) : today;
  // Any 7 consecutive days contain every weekday, so the loop is bounded by a week.
  for (
    let day = addDays(lastCompletedDate, 1), i = 0;
    day < until && i < 7;
    day = addDays(day, 1), i++
  ) {
    if (scheduled.has(weekdayOf(day))) return false;
  }
  return true;
}

/** Streak value to show right now, given what was stored at the last completion/undo. */
export function effectiveStreak(params: {
  stored: { currentStreak: number; longestStreak: number; lastCompletedDate: string | null } | null;
  scheduleDays: Iterable<number>;
  today: string;
  endDate?: string | null;
}): { current: number; longest: number } {
  if (!params.stored) return { current: 0, longest: 0 };
  const alive = isStreakAlive({
    lastCompletedDate: params.stored.lastCompletedDate,
    scheduleDays: params.scheduleDays,
    today: params.today,
    endDate: params.endDate,
  });
  return {
    current: alive ? params.stored.currentStreak : 0,
    longest: params.stored.longestStreak,
  };
}
