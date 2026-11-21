import { PetCareType } from '../generated/prisma/enums';

/**
 * Pet business rules (spec §3.5, ch. 6). Pure functions → unit-testable.
 * Kindness by design: happiness decays slowly and never below a floor, and neglect never takes
 * away XP, levels or accessories.
 */

export const PET_SPECIES = ['FOX', 'SNOW_FOX', 'NIGHT_FOX'] as const;
export type PetSpecies = (typeof PET_SPECIES)[number];

export interface CareRule {
  /** Pet XP (spec: 5–15) */
  xp: number;
  happiness: number;
  cooldownMinutes: number;
}

export const CARE_RULES: Record<PetCareType, CareRule> = {
  PET: { xp: 5, happiness: 8, cooldownMinutes: 30 },
  FEED: { xp: 10, happiness: 15, cooldownMinutes: 4 * 60 },
  PLAY: { xp: 15, happiness: 20, cooldownMinutes: 3 * 60 },
  BATH: { xp: 10, happiness: 12, cooldownMinutes: 12 * 60 },
};

/** Happiness gained when the owner completes a habit. */
export const COMPLETION_HAPPINESS = 5;

export const HAPPINESS_MAX = 100;
/** The pet never drops below this — it misses you, it is never "dying". */
export const HAPPINESS_FLOOR = 25;
/** Points lost per hour without any interaction. */
export const HAPPINESS_DECAY_PER_HOUR = 1.5;

export function effectiveHappiness(
  stored: number,
  updatedAt: Date,
  now: Date = new Date(),
): number {
  const hours = Math.max(0, (now.getTime() - updatedAt.getTime()) / 3_600_000);
  const decayed = Math.round(stored - hours * HAPPINESS_DECAY_PER_HOUR);
  // Decay can only pull down to the floor; it never pushes a value that is already lower.
  return Math.min(HAPPINESS_MAX, Math.max(Math.min(stored, HAPPINESS_FLOOR), decayed));
}

export function addHappiness(current: number, delta: number): number {
  return Math.max(0, Math.min(HAPPINESS_MAX, current + delta));
}

export type PetMood = 'HAPPY' | 'CONTENT' | 'LONELY';

export function moodOf(happiness: number): PetMood {
  if (happiness >= 70) return 'HAPPY';
  if (happiness >= 40) return 'CONTENT';
  return 'LONELY';
}

/** When the given care type can be used again (null = available now). */
export function cooldownEndsAt(
  type: PetCareType,
  lastAt: Date | null | undefined,
  now: Date = new Date(),
): Date | null {
  if (!lastAt) return null;
  const ends = new Date(lastAt.getTime() + CARE_RULES[type].cooldownMinutes * 60_000);
  return ends > now ? ends : null;
}
