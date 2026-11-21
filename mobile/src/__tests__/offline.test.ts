import { describe, expect, it } from '@jest/globals';
import {
  backoffMs,
  classifyResult,
  decodeJwtSub,
  localDateKey,
  overlayHabit,
  QueuedOp,
  summarizeRewards,
  weekdayOfKey,
} from '@/services/offline/logic';
import type { Habit, SyncOperationResult } from '@/types/api';

const habit = (over: Partial<Habit> = {}): Habit =>
  ({
    id: 'h1',
    title: 'Ном унших',
    startDate: '2026-11-01',
    endDate: null,
    scheduleDays: [0, 1, 2, 3, 4, 5, 6],
    today: {
      date: '2026-11-21',
      isScheduled: true,
      isCompleted: false,
      completionId: null,
      completedBy: null,
      canUndo: false,
    },
    streak: { current: 0, longest: 0 },
    ...over,
  }) as Habit;

const op = (o: Partial<QueuedOp> & Pick<QueuedOp, 'type' | 'payload'>): QueuedOp =>
  ({
    operationId: 'op',
    createdAt: '2026-11-21T01:00:00.000Z',
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    label: 'x',
    ...o,
  }) as QueuedOp;

describe('offline logic', () => {
  it('backs off exponentially with a cap', () => {
    expect(backoffMs(1, () => 0.5)).toBe(2_000);
    expect(backoffMs(3, () => 0.5)).toBe(8_000);
    expect(backoffMs(30, () => 0.5)).toBe(300_000);
  });

  it('formats local dates and weekdays like the backend', () => {
    expect(localDateKey(new Date(2026, 10, 1))).toBe('2026-11-01');
    expect(weekdayOfKey('2026-11-21')).toBe(6); // Saturday
  });

  it('classifies sync results', () => {
    expect(classifyResult({ status: 'PROCESSED', errorCode: null, type: 'PET_CARE' })).toBe('done');
    expect(classifyResult({ status: 'CONFLICT', errorCode: 'ALREADY_COMPLETED', type: 'HABIT_COMPLETION' })).toBe('issue');
    expect(classifyResult({ status: 'FAILED', errorCode: 'INTERNAL_ERROR', type: 'PET_CARE' })).toBe('retry');
    expect(classifyResult(undefined)).toBe('retry');
    expect(
      classifyResult({ status: 'REJECTED', errorCode: 'COMPLETION_NOT_FOUND', type: 'COMPLETION_UNDO' }),
    ).toBe('done');
  });

  it('sums only server-confirmed rewards', () => {
    const r = (o: Partial<SyncOperationResult>) => o as SyncOperationResult;
    expect(
      summarizeRewards([
        r({ type: 'HABIT_COMPLETION', status: 'PROCESSED', data: { rewards: { personalXP: 20, familyXP: 5, petXP: 20 } } }),
        r({ type: 'PET_CARE', status: 'PROCESSED', data: { petXP: 15 } }),
        r({ type: 'HABIT_COMPLETION', status: 'CONFLICT', data: null }),
      ]),
    ).toEqual({ personalXP: 20, familyXP: 5, petXP: 35 });
  });

  it('overlays a queued completion as done and cancellable', () => {
    const shown = overlayHabit(
      habit(),
      [op({ type: 'HABIT_COMPLETION', payload: { habitId: 'h1', localDate: '2026-11-21', idempotencyKey: 'k' } })],
      '2026-11-21',
    );
    expect(shown.today).toMatchObject({ isCompleted: true, canUndo: true, completionId: null });
    expect(shown.pendingSync).toBe(true);
  });

  it('overlays a queued undo and ignores other habits', () => {
    const done = habit({ today: { ...habit().today, isCompleted: true, completionId: 'c1', canUndo: true } });
    const undone = overlayHabit(done, [op({ type: 'COMPLETION_UNDO', payload: { completionId: 'c1', habitId: 'h1' } })], '2026-11-21');
    expect(undone.today.isCompleted).toBe(false);
    const other = habit({ id: 'h2' });
    expect(overlayHabit(other, [op({ type: 'COMPLETION_UNDO', payload: { completionId: 'c1', habitId: 'h1' } })], '2026-11-21')).toBe(other);
  });

  it('rolls a cache from an earlier day over to today', () => {
    const old = habit({ scheduleDays: [1], today: { ...habit().today, date: '2026-11-20', isCompleted: true, completionId: 'c' } });
    const shown = overlayHabit(old, [], '2026-11-23'); // Monday
    expect(shown.today).toMatchObject({ date: '2026-11-23', isScheduled: true, isCompleted: false });
  });

  it('reads the user id from a JWT without verifying it', () => {
    const payload = 'eyJzdWIiOiJ1c2VyLTEifQ'; // {"sub":"user-1"}
    expect(decodeJwtSub(`x.${payload}.y`)).toBe('user-1');
    expect(decodeJwtSub('garbage')).toBeNull();
    expect(decodeJwtSub(null)).toBeNull();
  });
});
