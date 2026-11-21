import { achievementProgress, isAchieved, UserMetrics } from './achievement-rules';

const m = (over: Partial<UserMetrics> = {}): UserMetrics => ({
  totalCompletions: 0,
  completionDays: 0,
  bestStreak: 0,
  activeHabits: 0,
  level: 1,
  familyQuestsCompleted: 0,
  petLevel: 0,
  ...over,
});

describe('achievement rules', () => {
  it('maps each condition to its metric', () => {
    const metrics = m({
      totalCompletions: 4,
      bestStreak: 7,
      activeHabits: 5,
      completionDays: 30,
      level: 10,
    });
    expect(achievementProgress('FIRST_COMPLETION', metrics)).toBe(4);
    expect(achievementProgress('STREAK_DAYS', metrics)).toBe(7);
    expect(achievementProgress('ACTIVE_HABITS', metrics)).toBe(5);
    expect(achievementProgress('TOTAL_COMPLETION_DAYS', metrics)).toBe(30);
    expect(achievementProgress('USER_LEVEL', metrics)).toBe(10);
    expect(achievementProgress('PET_LEVEL', metrics)).toBe(0);
  });

  it('unlocks only when the threshold is reached', () => {
    expect(isAchieved({ condition: 'STREAK_DAYS', threshold: 7 }, m({ bestStreak: 6 }))).toBe(
      false,
    );
    expect(isAchieved({ condition: 'STREAK_DAYS', threshold: 7 }, m({ bestStreak: 7 }))).toBe(true);
    expect(isAchieved({ condition: 'FIRST_COMPLETION', threshold: 1 }, m())).toBe(false);
  });
});
