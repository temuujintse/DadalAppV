import { AchievementCondition } from '../generated/prisma/enums';

/** Everything an achievement condition can look at. Computed server-side only. */
export interface UserMetrics {
  totalCompletions: number;
  completionDays: number;
  /** Best streak that is still alive today (own habits + assigned SHARED habits). */
  bestStreak: number;
  activeHabits: number;
  level: number;
  familyQuestsCompleted: number;
  petLevel: number;
}

/** Current value of the metric a condition measures (pure → unit-testable). */
export function achievementProgress(condition: AchievementCondition, m: UserMetrics): number {
  switch (condition) {
    case 'FIRST_COMPLETION':
      return m.totalCompletions;
    case 'STREAK_DAYS':
      return m.bestStreak;
    case 'ACTIVE_HABITS':
      return m.activeHabits;
    case 'FAMILY_QUESTS_COMPLETED':
      return m.familyQuestsCompleted;
    case 'TOTAL_COMPLETION_DAYS':
      return m.completionDays;
    case 'PET_LEVEL':
      return m.petLevel;
    case 'USER_LEVEL':
      return m.level;
  }
}

export function isAchieved(
  achievement: { condition: AchievementCondition; threshold: number },
  m: UserMetrics,
): boolean {
  return achievementProgress(achievement.condition, m) >= achievement.threshold;
}
