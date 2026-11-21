import { addDays, weekdayOf } from '../common/utils/local-date';
import { computeStreak, effectiveStreak, isStreakAlive } from './streak-calculator';

const DAILY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

// 2026-11-21 is a Saturday.
const SAT = '2026-11-21';

describe('local date helpers', () => {
  it('knows the weekday and crosses month boundaries', () => {
    expect(weekdayOf(SAT)).toBe(6);
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('computeStreak', () => {
  it('counts consecutive scheduled days and keeps today pending', () => {
    const r = computeStreak({
      completedDates: ['2026-11-18', '2026-11-19', '2026-11-20'],
      scheduleDays: DAILY,
      startDate: '2026-11-01',
      today: SAT,
    });
    expect(r).toEqual({ current: 3, longest: 3, lastCompletedDate: '2026-11-20' });
  });

  it('adds today once it is completed', () => {
    const r = computeStreak({
      completedDates: ['2026-11-19', '2026-11-20', SAT],
      scheduleDays: DAILY,
      startDate: '2026-11-01',
      today: SAT,
    });
    expect(r.current).toBe(3);
  });

  it('resets after a missed scheduled day but remembers the longest run', () => {
    const r = computeStreak({
      completedDates: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-20'],
      scheduleDays: DAILY,
      startDate: '2026-11-01',
      today: SAT,
    });
    expect(r.current).toBe(1);
    expect(r.longest).toBe(3);
  });

  it('does not break on unscheduled days (weekend for a weekday habit)', () => {
    const r = computeStreak({
      completedDates: [
        '2026-11-12',
        '2026-11-13',
        '2026-11-16',
        '2026-11-17',
        '2026-11-18',
        '2026-11-19',
        '2026-11-20',
      ],
      scheduleDays: WEEKDAYS,
      startDate: '2026-11-12',
      today: '2026-11-22', // Sunday
    });
    expect(r.current).toBe(7);
  });

  it('ignores days before the start date', () => {
    const r = computeStreak({
      completedDates: [],
      scheduleDays: DAILY,
      startDate: SAT,
      today: SAT,
    });
    expect(r).toEqual({ current: 0, longest: 0, lastCompletedDate: null });
  });

  it('stops evaluating after the end date', () => {
    const r = computeStreak({
      completedDates: ['2026-11-17', '2026-11-18', '2026-11-19'],
      scheduleDays: DAILY,
      startDate: '2026-11-17',
      endDate: '2026-11-19',
      today: SAT,
    });
    expect(r.current).toBe(3);
  });
});

describe('isStreakAlive / effectiveStreak', () => {
  it('survives a weekend gap for a weekday habit', () => {
    expect(
      isStreakAlive({
        lastCompletedDate: '2026-11-20',
        scheduleDays: WEEKDAYS,
        today: '2026-11-23',
      }),
    ).toBe(true);
  });

  it('dies once a scheduled day has passed without completion', () => {
    expect(
      isStreakAlive({
        lastCompletedDate: '2026-11-20',
        scheduleDays: WEEKDAYS,
        today: '2026-11-24',
      }),
    ).toBe(false);
  });

  it('is alive when completed today and dead without any completion', () => {
    expect(isStreakAlive({ lastCompletedDate: SAT, scheduleDays: DAILY, today: SAT })).toBe(true);
    expect(isStreakAlive({ lastCompletedDate: null, scheduleDays: DAILY, today: SAT })).toBe(false);
  });

  it('is not broken by days after the habit ended', () => {
    expect(
      isStreakAlive({
        lastCompletedDate: '2026-11-19',
        scheduleDays: DAILY,
        today: SAT,
        endDate: '2026-11-19',
      }),
    ).toBe(true);
  });

  it('shows 0 for a broken streak but keeps the longest', () => {
    expect(
      effectiveStreak({
        stored: { currentStreak: 5, longestStreak: 9, lastCompletedDate: '2026-11-18' },
        scheduleDays: DAILY,
        today: SAT,
      }),
    ).toEqual({ current: 0, longest: 9 });
    expect(
      effectiveStreak({
        stored: { currentStreak: 5, longestStreak: 9, lastCompletedDate: '2026-11-20' },
        scheduleDays: DAILY,
        today: SAT,
      }),
    ).toEqual({ current: 5, longest: 9 });
  });
});
