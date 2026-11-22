import {
  computeMetrics,
  inventedNumbers,
  lastCompletePeriod,
  numbersAllowed,
} from './analytics/metrics';
import { chooseEvent, PetMoment, templateFor, toAppAnimation } from './pet/pet-rules';
import { PlanCandidate, roundUpTo5, validatePlan } from './planner/plan-rules';

const cand = (ref: string, title: string): PlanCandidate => ({
  ref,
  habitId: `id-${ref}`,
  title,
  difficulty: 'EASY',
  reminderTime: null,
});
const CANDS = [cand('h1', 'Ном'), cand('h2', 'Гүйлт'), cand('h3', 'Ус')];
const WINDOW = { from: '08:00', to: '10:00' };

describe('planner rules', () => {
  it('keeps known refs in time order and resolves overlaps by shifting', () => {
    const { items, warnings } = validatePlan(
      [
        { ref: 'h2', startTime: '08:10', durationMinutes: 30, note: '' },
        { ref: 'h1', startTime: '08:00', durationMinutes: 20, note: 'Өглөө' },
        { ref: 'h3', startTime: '08:20', durationMinutes: 10, note: '' },
        { ref: 'zz', startTime: '09:00', durationMinutes: 10, note: '' },
        { ref: 'h1', startTime: '09:30', durationMinutes: 10, note: '' },
      ],
      CANDS,
      WINDOW,
      null,
    );
    expect(items.map((i) => [i.title, i.startTime, i.durationMinutes])).toEqual([
      ['Ном', '08:00', 20],
      ['Гүйлт', '08:20', 30],
      ['Ус', '08:50', 10],
    ]);
    expect(warnings.map((w) => w.code)).toEqual(['CONFLICT_RESOLVED']);
  });

  it('drops items outside the window, clamps durations and warns about overload and gaps', () => {
    const { items, warnings } = validatePlan(
      [
        { ref: 'h1', startTime: '07:00', durationMinutes: 500, note: '' },
        { ref: 'h2', startTime: '09:59', durationMinutes: 30, note: '' },
        { ref: 'h3', startTime: 'later', durationMinutes: 10, note: '' },
      ],
      CANDS,
      WINDOW,
      60,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ startTime: '08:00', durationMinutes: 120 });
    const codes = warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(['OUTSIDE_WINDOW', 'NOT_PLANNED', 'OVERLOAD']));
    expect(warnings.find((w) => w.code === 'NOT_PLANNED')!.message).toContain('Гүйлт');
  });

  it('rounds the start of the day up to 5 minutes', () => {
    expect(roundUpTo5('09:02')).toBe('09:05');
    expect(roundUpTo5('09:00')).toBe('09:00');
  });
});

describe('pet companion rules', () => {
  const m = (over: Partial<PetMoment> = {}): PetMoment => ({
    petName: 'Бамбаа',
    dueToday: 3,
    doneToday: 1,
    bestCurrentStreak: 2,
    daysSinceLastCompletion: 0,
    completedToday: true,
    ...over,
  });

  it('picks the moment from backend facts', () => {
    expect(chooseEvent(m({ daysSinceLastCompletion: 4, completedToday: false }))).toBe(
      'INACTIVE_RETURN',
    );
    expect(chooseEvent(m({ doneToday: 3 }))).toBe('DAILY_GOAL_COMPLETED');
    expect(chooseEvent(m({ bestCurrentStreak: 7 }))).toBe('STREAK_MILESTONE');
    expect(chooseEvent(m())).toBe('GREETING');
    expect(
      chooseEvent(
        m({ dueToday: 0, doneToday: 0, daysSinceLastCompletion: null, completedToday: false }),
      ),
    ).toBe('GREETING');
  });

  it('fills templates deterministically and maps animations to app states', () => {
    const a = templateFor('STREAK_MILESTONE', m({ bestCurrentStreak: 7 }), 1);
    expect(a.message).toContain('7 өдөр');
    expect(templateFor('GREETING', m(), 5)).toEqual(templateFor('GREETING', m(), 5));
    expect(toAppAnimation('EXCITED')).toBe('CELEBRATE');
    expect(toAppAnimation('CARING')).toBe('CARE');
    expect(toAppAnimation('LEVEL_UP')).toBe('LEVEL_UP');
  });
});

describe('analytics metrics', () => {
  it('uses the last complete Monday–Sunday week and calendar month', () => {
    // 2026-11-22 is a Sunday → the last complete week is 9–15 Nov.
    expect(lastCompletePeriod('WEEKLY', '2026-11-22')).toEqual({
      type: 'WEEKLY',
      key: 'W2026-11-09',
      from: '2026-11-09',
      to: '2026-11-15',
    });
    expect(lastCompletePeriod('MONTHLY', '2026-01-10')).toEqual({
      type: 'MONTHLY',
      key: 'M2025-12',
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('computes rates, comparison, best/least habit and weekday pattern', () => {
    const period = lastCompletePeriod('WEEKLY', '2026-11-22');
    const habits = [
      {
        id: 'a',
        title: 'Ном',
        scheduleDays: [0, 1, 2, 3, 4, 5, 6],
        startDate: '2026-11-01',
        endDate: null,
      },
      { id: 'b', title: 'Гүйлт', scheduleDays: [1, 3], startDate: '2026-11-01', endDate: null },
    ];
    const completions = [
      ...['09', '10', '11', '12', '13', '14', '15'].map((d) => ({
        habitId: 'a',
        localDate: `2026-11-${d}`,
      })),
      { habitId: 'b', localDate: '2026-11-09' },
      { habitId: 'a', localDate: '2026-11-03' }, // previous week
    ];
    const m = computeMetrics(period, habits, completions, [7, 1]);
    expect(m).toMatchObject({
      scheduled: 9,
      completed: 8,
      completionRate: 89,
      previous: { scheduled: 9, completed: 1, completionRate: 11 },
      rateChange: 78,
      bestHabit: { title: 'Ном', completionRate: 100 },
      leastConsistentHabit: { title: 'Гүйлт', completionRate: 50 },
      averageCurrentStreak: 4,
    });
    expect(m.byWeekday[1]).toBe(2); // Monday 9 Nov: both habits
  });

  it('rejects numbers that are not in the metrics', () => {
    const period = lastCompletePeriod('WEEKLY', '2026-11-22');
    const m = computeMetrics(period, [], [], []);
    const allowed = numbersAllowed(m);
    expect(inventedNumbers(['Та 0 дадал биелүүлсэн', '7 хоногт'], allowed)).toEqual([]);
    expect(inventedNumbers(['Биелэлт 95% болсон'], allowed)).toEqual(['95']);
  });
});
