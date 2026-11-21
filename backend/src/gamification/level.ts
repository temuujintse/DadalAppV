/**
 * Level math (spec §3.4): XP needed to go from level L to L+1 is 100 + 50 × (L − 1).
 * Level is always derived from lifetime XP, never stored independently of it, so spending
 * XP on rewards can never lower a level and undoing a completion can never inflate one.
 */
export function xpForNextLevel(level: number): number {
  return 100 + 50 * (Math.max(1, level) - 1);
}

export interface LevelProgress {
  level: number;
  /** XP collected inside the current level */
  xpIntoLevel: number;
  /** XP needed to finish the current level */
  xpForNextLevel: number;
}

export function levelFromXp(lifetimeXP: number): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, Math.floor(lifetimeXP));
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpForNextLevel: xpForNextLevel(level) };
}
