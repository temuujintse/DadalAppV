/**
 * Display-only level math. The backend owns XP and level; this just splits lifetime XP
 * into "XP inside the current level" for the progress bar.
 * XP_next(L) = 100 + 50 × (L − 1)
 */
export function xpForNextLevel(level: number): number {
  return 100 + 50 * (Math.max(1, level) - 1);
}

/** Total lifetime XP needed to *reach* `level` (level 1 starts at 0). */
export function xpToReachLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForNextLevel(l);
  return total;
}

export function levelProgress(level: number, lifetimeXP: number) {
  const base = xpToReachLevel(level);
  const needed = xpForNextLevel(level);
  const current = Math.max(0, Math.min(needed, lifetimeXP - base));
  return { current, needed, ratio: needed === 0 ? 0 : current / needed };
}
