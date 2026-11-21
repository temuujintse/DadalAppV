import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  celebrateClaim,
  celebrateCompletion,
  useCelebrationStore,
} from '@/store/celebration.store';
import type { CompletionResult } from '@/types/api';

const base: CompletionResult = {
  completion: {
    id: 'c1',
    habitId: 'h1',
    localDate: '2026-11-21',
    completedBy: { userId: 'u1', displayName: 'Сараа', avatarKey: 'fox' },
    note: null,
    source: 'ONLINE',
    createdAt: '2026-11-21T08:00:00Z',
  },
  streak: { current: 1, longest: 1 },
  replayed: false,
  rewards: { personalXP: 20, familyXP: 20, petXP: 0 },
  gamification: {
    level: 2,
    lifetimeXP: 120,
    balanceXP: 120,
    xpIntoLevel: 20,
    xpForNextLevel: 150,
    leveledUp: true,
  },
  family: {
    level: 1,
    lifetimeXP: 40,
    balanceXP: 40,
    xpIntoLevel: 40,
    xpForNextLevel: 100,
    leveledUp: false,
  },
  pet: {
    level: 1,
    lifetimeXP: 20,
    xpIntoLevel: 20,
    xpForNextLevel: 100,
    happiness: 85,
    leveledUp: false,
  },
  accessoriesUnlocked: [],
  questsCompleted: [{ id: 'q1', title: 'Өдрийн хоёр алхам', scope: 'USER' }],
  achievementsUnlocked: [
    {
      id: 'a1',
      key: 'first_step',
      title: 'Анхны алхам',
      description: 'x',
      icon: 'footprints',
      xpReward: 25,
    },
  ],
};

describe('celebrateCompletion', () => {
  beforeEach(() => useCelebrationStore.setState({ toast: null, queue: [] }));

  it('shows the XP toast and queues level-up before achievements', () => {
    celebrateCompletion(base);
    const s = useCelebrationStore.getState();
    expect(s.toast).toMatchObject({ personalXP: 20, familyXP: 20, petXP: 0 });
    expect(s.queue.map((q) => q.kind)).toEqual(['levelUp', 'achievement', 'questReady']);
    s.dismiss();
    expect(useCelebrationStore.getState().queue.map((q) => q.kind)).toEqual([
      'achievement',
      'questReady',
    ]);
  });

  it('stays silent for replayed requests (nothing new was earned)', () => {
    celebrateCompletion({ ...base, replayed: true });
    const s = useCelebrationStore.getState();
    expect(s.toast).toBeNull();
    expect(s.queue).toEqual([]);
  });
});

describe('celebrateClaim', () => {
  beforeEach(() => useCelebrationStore.setState({ toast: null, queue: [] }));

  it('toasts family XP for a family quest without a pet line', () => {
    celebrateClaim({
      quest: {} as never,
      rewards: { personalXP: 0, familyXP: 50, petXP: 0 },
      gamification: { ...base.gamification, leveledUp: false },
      family: { ...base.family!, leveledUp: true, level: 2 },
      achievementsUnlocked: [],
    });
    const s = useCelebrationStore.getState();
    expect(s.toast).toMatchObject({ personalXP: 0, familyXP: 50, petXP: 0 });
    expect(s.queue).toEqual([{ kind: 'levelUp', level: 2, scope: 'family' }]);
  });
});
