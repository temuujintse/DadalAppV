import { addDays, weekdayOf } from '../common/utils/local-date';
import { localDateString, zonedMidnightUtc } from '../common/utils/timezone.util';
import { QuestPeriod } from '../generated/prisma/enums';

export interface PeriodWindow {
  /** Stored in QuestProgress.periodKey: "2026-11-21" (daily) or "W2026-11-16" (week starting Monday). */
  key: string;
  /** First and last local date of the period (inclusive). */
  from: string;
  to: string;
  /** UTC instant the period starts / the next one starts. */
  startsAt: Date;
  resetsAt: Date;
}

/** Current quest period in the subject's timezone. Weeks start on Monday (Mongolian convention). */
export function currentPeriod(
  period: QuestPeriod,
  timeZone: string,
  now = new Date(),
): PeriodWindow {
  const today = localDateString(timeZone, now);
  if (period === 'DAILY') {
    return {
      key: today,
      from: today,
      to: today,
      startsAt: zonedMidnightUtc(today, timeZone),
      resetsAt: zonedMidnightUtc(addDays(today, 1), timeZone),
    };
  }
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  return {
    key: `W${monday}`,
    from: monday,
    to: addDays(monday, 6),
    startsAt: zonedMidnightUtc(monday, timeZone),
    resetsAt: zonedMidnightUtc(addDays(monday, 7), timeZone),
  };
}

export type QuestStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED';

/** Status after a recount. A claimed quest stays claimed; otherwise it follows the progress. */
export function nextStatus(
  current: QuestStatus | null,
  progress: number,
  target: number,
): QuestStatus {
  if (current === 'CLAIMED') return 'CLAIMED';
  return progress >= target ? 'COMPLETED' : 'IN_PROGRESS';
}
