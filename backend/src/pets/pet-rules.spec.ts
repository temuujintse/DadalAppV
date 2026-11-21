import {
  addHappiness,
  CARE_RULES,
  cooldownEndsAt,
  effectiveHappiness,
  HAPPINESS_FLOOR,
  moodOf,
} from './pet-rules';

const NOW = new Date('2026-11-21T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

describe('pet rules', () => {
  it('keeps care XP inside the 5–15 range from the spec', () => {
    for (const rule of Object.values(CARE_RULES)) {
      expect(rule.xp).toBeGreaterThanOrEqual(5);
      expect(rule.xp).toBeLessThanOrEqual(15);
    }
  });

  it('decays happiness gently and never below the floor', () => {
    expect(effectiveHappiness(80, NOW, NOW)).toBe(80);
    expect(effectiveHappiness(80, hoursAgo(10), NOW)).toBe(65);
    expect(effectiveHappiness(80, hoursAgo(1000), NOW)).toBe(HAPPINESS_FLOOR);
  });

  it('never raises a value that is already below the floor', () => {
    expect(effectiveHappiness(10, hoursAgo(100), NOW)).toBe(10);
  });

  it('clamps happiness changes to 0–100', () => {
    expect(addHappiness(95, 20)).toBe(100);
    expect(addHappiness(5, -20)).toBe(0);
  });

  it('derives a kind mood label', () => {
    expect(moodOf(90)).toBe('HAPPY');
    expect(moodOf(50)).toBe('CONTENT');
    expect(moodOf(25)).toBe('LONELY');
  });

  it('computes care cooldowns', () => {
    expect(cooldownEndsAt('PET', null, NOW)).toBeNull();
    expect(cooldownEndsAt('PET', hoursAgo(1), NOW)).toBeNull();
    expect(cooldownEndsAt('FEED', hoursAgo(1), NOW)?.toISOString()).toBe(
      '2026-11-21T15:00:00.000Z',
    );
  });
});
