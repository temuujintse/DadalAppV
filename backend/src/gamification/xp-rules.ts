import { HabitDifficulty } from '../generated/prisma/enums';

/**
 * Server-side XP configuration (spec §3.4). The client never decides XP amounts.
 * Phase 5's gamification engine awards these through the XP ledger.
 */
export const HABIT_XP: Record<HabitDifficulty, number> = {
  EASY: 10,
  MEDIUM: 20,
  HARD: 30,
};
