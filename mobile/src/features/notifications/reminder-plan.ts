/**
 * Local reminder planning (pure, unit tested). Reminders are scheduled on the device, so they
 * work offline and need no server. The plan is recomputed whenever habits change or the app
 * opens, so a habit completed today simply loses today's reminder.
 */
import type { Habit } from '@/types/api';
import { localDateKey, weekdayOfKey } from '@/services/offline/logic';

export interface PlannedReminder {
  /** Stable id: same plan → same ids (scheduling is idempotent). */
  id: string;
  title: string;
  body: string;
  date: Date;
  data: { route: string; kind: 'habit' | 'nudge' };
}

export interface ReminderOptions {
  habitReminders: boolean;
  eveningNudge: boolean;
}

/** iOS keeps at most 64 pending local notifications; stay well below. */
export const MAX_PENDING = 56;
export const NUDGE_HOUR = 20;

function at(dayKey: string, hhmm: string): Date {
  const [y, m, d] = dayKey.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function addDaysKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y, m - 1, d + days));
}

function scheduledOn(habit: Habit, day: string): boolean {
  if (habit.status !== 'ACTIVE' || !habit.canComplete) return false;
  if (day < habit.startDate || (habit.endDate && day > habit.endDate)) return false;
  return habit.scheduleDays.includes(weekdayOfKey(day));
}

export function planReminders(
  habits: readonly Habit[],
  now: Date,
  opts: ReminderOptions,
): PlannedReminder[] {
  const today = localDateKey(now);
  const plan: PlannedReminder[] = [];

  if (opts.habitReminders) {
    const withTime = habits.filter((h) => h.reminderTime && h.status === 'ACTIVE' && h.canComplete);
    const days = Math.max(1, Math.min(7, Math.floor(MAX_PENDING / Math.max(1, withTime.length))));
    for (const h of withTime) {
      for (let d = 0; d < days; d++) {
        const day = addDaysKey(today, d);
        if (!scheduledOn(h, day)) continue;
        if (d === 0 && h.today.date === today && h.today.isCompleted) continue;
        const date = at(day, h.reminderTime!);
        if (date <= now) continue;
        const streak = d === 0 ? h.streak.current : 0;
        plan.push({
          id: `habit:${h.id}:${day}`,
          title: h.title,
          body:
            streak > 0
              ? `${streak} өдрийн streak-ээ үргэлжлүүлэх цаг боллоо 🔥`
              : 'Дадлаа биелүүлэх цаг боллоо ✨',
          date,
          data: { route: `/habit/${h.id}`, kind: 'habit' },
        });
      }
    }
  }

  if (opts.eveningNudge) {
    const dueToday = habits.filter((h) => scheduledOn(h, today));
    const leftToday = dueToday.filter((h) => !(h.today.date === today && h.today.isCompleted));
    const tonight = at(today, `${NUDGE_HOUR}:00`);
    if (leftToday.length > 0 && tonight > now) {
      plan.push({
        id: `nudge:${today}`,
        title: 'Өнөөдрийн дадлууд 🌙',
        body: `${leftToday.length} дадал үлдлээ. Streak-ээ хадгалаарай!`,
        date: tonight,
        data: { route: '/home', kind: 'nudge' },
      });
    } else {
      const tomorrow = addDaysKey(today, 1);
      if (habits.some((h) => scheduledOn(h, tomorrow))) {
        plan.push({
          id: `nudge:${tomorrow}`,
          title: 'Өнөөдрийн дадлууд 🌙',
          body: 'Өнөөдрийн дадлаа биелүүлсэн үү? Streak-ээ хадгалаарай!',
          date: at(tomorrow, `${NUDGE_HOUR}:00`),
          data: { route: '/home', kind: 'nudge' },
        });
      }
    }
  }

  return plan.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX_PENDING);
}
