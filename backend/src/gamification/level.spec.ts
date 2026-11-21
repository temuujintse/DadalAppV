import { levelFromXp, xpForNextLevel } from './level';

describe('level math', () => {
  it('follows XP_next = 100 + 50 × (L − 1)', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(150);
    expect(xpForNextLevel(10)).toBe(550);
  });

  it('derives level and progress from lifetime XP', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNextLevel: 100 });
    expect(levelFromXp(99)).toEqual({ level: 1, xpIntoLevel: 99, xpForNextLevel: 100 });
    expect(levelFromXp(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 150 });
    expect(levelFromXp(250)).toEqual({ level: 3, xpIntoLevel: 0, xpForNextLevel: 200 });
    expect(levelFromXp(260)).toEqual({ level: 3, xpIntoLevel: 10, xpForNextLevel: 200 });
  });

  it('never goes below level 1', () => {
    expect(levelFromXp(-50).level).toBe(1);
  });
});
