import { currentPeriod, nextStatus } from './quest-period';

describe('quest periods', () => {
  // 2026-11-21 (Saturday) 10:00 in Ulaanbaatar
  const NOW = new Date('2026-11-21T02:00:00Z');

  it('builds the daily window in the subject timezone', () => {
    const p = currentPeriod('DAILY', 'Asia/Ulaanbaatar', NOW);
    expect(p).toMatchObject({ key: '2026-11-21', from: '2026-11-21', to: '2026-11-21' });
    expect(p.startsAt.toISOString()).toBe('2026-11-20T16:00:00.000Z');
    expect(p.resetsAt.toISOString()).toBe('2026-11-21T16:00:00.000Z');
  });

  it('builds a Monday-first weekly window', () => {
    const p = currentPeriod('WEEKLY', 'Asia/Ulaanbaatar', NOW);
    expect(p).toMatchObject({ key: 'W2026-11-16', from: '2026-11-16', to: '2026-11-22' });
    expect(p.resetsAt.toISOString()).toBe('2026-11-22T16:00:00.000Z');
  });

  it('uses the local date, not UTC, near midnight', () => {
    // 2026-11-21 17:30 UTC = 2026-11-22 01:30 in Ulaanbaatar (a Sunday, still the same week)
    const late = new Date('2026-11-21T17:30:00Z');
    expect(currentPeriod('DAILY', 'Asia/Ulaanbaatar', late).key).toBe('2026-11-22');
    expect(currentPeriod('WEEKLY', 'Asia/Ulaanbaatar', late).key).toBe('W2026-11-16');
  });

  it('keeps claimed quests claimed and otherwise follows progress', () => {
    expect(nextStatus(null, 1, 2)).toBe('IN_PROGRESS');
    expect(nextStatus('IN_PROGRESS', 2, 2)).toBe('COMPLETED');
    expect(nextStatus('COMPLETED', 1, 2)).toBe('IN_PROGRESS'); // undo before claiming
    expect(nextStatus('CLAIMED', 0, 2)).toBe('CLAIMED');
  });
});
