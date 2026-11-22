import { describe, expect, it } from '@jest/globals';
import { MAX_PENDING, planReminders } from '@/features/notifications/reminder-plan';
import type { Habit } from '@/types/api';

// Saturday 2026-11-21, 10:00 local
const NOW = new Date(2026, 10, 21, 10, 0, 0);
const TODAY = '2026-11-21';
const ALL = { habitReminders: true, eveningNudge: true };

const habit = (over: Partial<Habit> = {}): Habit =>
  ({
    id: 'h1',
    title: 'Ном унших',
    status: 'ACTIVE',
    canComplete: true,
    startDate: '2026-11-01',
    endDate: null,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    reminderTime: '19:30',
    today: {
      date: TODAY,
      isScheduled: true,
      isCompleted: false,
      completionId: null,
      completedBy: null,
      canUndo: false,
    },
    streak: { current: 3, longest: 3 },
    ...over,
  }) as Habit;

const habitOnly = (h: Habit[]) => planReminders(h, NOW, { habitReminders: true, eveningNudge: false });

describe('planReminders', () => {
  it('schedules a habit reminder today and on the following scheduled days', () => {
    const plan = habitOnly([habit()]);
    expect(plan[0]).toMatchObject({
      id: `habit:h1:${TODAY}`,
      title: 'Ном унших',
      data: { route: '/habit/h1', kind: 'habit' },
    });
    expect(plan[0].date).toEqual(new Date(2026, 10, 21, 19, 30));
    expect(plan[0].body).toContain('3 өдрийн streak');
    expect(plan).toHaveLength(7);
  });

  it('skips today when already completed or when the time has passed', () => {
    const done = habit({ today: { ...habit().today, isCompleted: true } });
    expect(habitOnly([done])[0].id).toBe('habit:h1:2026-11-22');
    const early = habit({ reminderTime: '08:00' });
    expect(habitOnly([early])[0].id).toBe('habit:h1:2026-11-22');
  });

  it('respects the weekly schedule, end date, archive and assignment', () => {
    const mondays = habitOnly([habit({ scheduleDays: [1] })]);
    expect(mondays.map((p) => p.id)).toEqual(['habit:h1:2026-11-23']);
    expect(habitOnly([habit({ endDate: TODAY })]).map((p) => p.id)).toEqual([`habit:h1:${TODAY}`]);
    expect(habitOnly([habit({ status: 'ARCHIVED' })])).toHaveLength(0);
    expect(habitOnly([habit({ canComplete: false })])).toHaveLength(0);
    expect(habitOnly([habit({ reminderTime: null })])).toHaveLength(0);
  });

  it('stays under the iOS pending-notification limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => habit({ id: `h${i}` }));
    const plan = planReminders(many, NOW, ALL);
    expect(plan.length).toBeLessThanOrEqual(MAX_PENDING);
    expect(plan.some((p) => p.id === `nudge:${TODAY}`)).toBe(true);
  });

  it('nudges tonight while habits are left, otherwise tomorrow', () => {
    const nudgeOnly = (h: Habit[]) =>
      planReminders(h, NOW, { habitReminders: false, eveningNudge: true });
    const tonight = nudgeOnly([habit({ reminderTime: null })]);
    expect(tonight).toHaveLength(1);
    expect(tonight[0]).toMatchObject({ id: `nudge:${TODAY}`, data: { route: '/home' } });
    expect(tonight[0].body).toContain('1 дадал үлдлээ');

    const done = habit({ today: { ...habit().today, isCompleted: true } });
    expect(nudgeOnly([done])[0].id).toBe('nudge:2026-11-22');
  });

  it('plans nothing when both options are off', () => {
    expect(planReminders([habit()], NOW, { habitReminders: false, eveningNudge: false })).toEqual(
      [],
    );
  });
});
