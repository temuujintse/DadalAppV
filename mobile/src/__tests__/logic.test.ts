import { describe, expect, it } from '@jest/globals';
import { loginSchema, registerSchema } from '@/features/auth/schemas';
import { familyUi } from '@/features/family/roles';
import { formatInviteCode, joinFamilySchema } from '@/features/family/schemas';
import { levelProgress, xpForNextLevel, xpToReachLevel } from '@/features/gamification/level';
import { ApiError } from '@/services/api/errors';
import { formatLongDate, formatTimeLeft, greeting } from '@/utils/date';

describe('level math (display only)', () => {
  it('follows XP_next = 100 + 50 × (level − 1)', () => {
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(2)).toBe(150);
    expect(xpForNextLevel(5)).toBe(300);
  });

  it('computes cumulative thresholds and in-level progress', () => {
    expect(xpToReachLevel(1)).toBe(0);
    expect(xpToReachLevel(3)).toBe(250);
    expect(levelProgress(2, 175)).toEqual({ current: 75, needed: 150, ratio: 0.5 });
    expect(levelProgress(1, 0).ratio).toBe(0);
  });
});

describe('Mongolian date helpers', () => {
  it('formats the long date', () => {
    expect(formatLongDate(new Date(2026, 10, 21))).toBe('11-р сарын 21, Бямба');
  });

  it('greets by time of day', () => {
    expect(greeting(new Date(2026, 0, 1, 8))).toBe('Өглөөний мэнд');
    expect(greeting(new Date(2026, 0, 1, 14))).toBe('Өдрийн мэнд');
    expect(greeting(new Date(2026, 0, 1, 21))).toBe('Оройн мэнд');
  });

  it('formats remaining time', () => {
    const now = new Date('2026-11-21T00:00:00Z');
    expect(formatTimeLeft('2026-11-24T00:00:00Z', now)).toBe('3 өдөр');
    expect(formatTimeLeft('2026-11-21T05:00:00Z', now)).toBe('5 цаг');
    expect(formatTimeLeft('2026-11-20T00:00:00Z', now)).toBe('дууссан');
  });
});

describe('form schemas', () => {
  it('validates register input with Mongolian messages', () => {
    const bad = registerSchema.safeParse({ displayName: ' ', email: 'x', password: 'abc' });
    expect(bad.success).toBe(false);
    const messages = bad.error!.issues.map((i) => i.message);
    expect(messages).toContain('Нэрээ оруулна уу.');
    expect(messages).toContain('Имэйл хаяг буруу байна.');

    const ok = registerSchema.safeParse({
      displayName: 'Сараа',
      email: 'saraa@example.com',
      password: 'нууцүг123',
    });
    expect(ok.success).toBe(true);
  });

  it('requires both login fields', () => {
    expect(loginSchema.safeParse({ email: 'a@b.mn', password: '' }).success).toBe(false);
  });

  it('formats and normalises invite codes', () => {
    expect(formatInviteCode('7kq2mx9dpa')).toBe('7KQ2M-X9DPA');
    expect(formatInviteCode('7kq')).toBe('7KQ');
    expect(joinFamilySchema.parse({ code: '7kq2m-x9dpa' }).code).toBe('7KQ2MX9DPA');
    expect(joinFamilySchema.safeParse({ code: '123' }).success).toBe(false);
  });
});

describe('family UI permissions mirror the backend policy', () => {
  it('only OWNER/PARENT can invite; PARENT cannot invite PARENT', () => {
    expect(familyUi.canInvite('CHILD')).toBe(false);
    expect(familyUi.invitableRoles('PARENT')).not.toContain('PARENT');
    expect(familyUi.invitableRoles('OWNER')).toContain('PARENT');
  });

  it('protects the owner and limits parents', () => {
    expect(familyUi.canRemove('PARENT', 'OWNER')).toBe(false);
    expect(familyUi.canRemove('PARENT', 'PARENT')).toBe(false);
    expect(familyUi.canRemove('PARENT', 'CHILD')).toBe(true);
    expect(familyUi.canTransferTo('OWNER', 'CHILD')).toBe(false);
  });
});

describe('ApiError', () => {
  it('maps known codes to friendly copy and keeps server messages otherwise', () => {
    const limited = ApiError.fromEnvelope(429, {
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many' },
    });
    expect(limited.message).toMatch(/Хэт олон/);

    const custom = ApiError.fromEnvelope(409, {
      success: false,
      error: { code: 'ALREADY_IN_FAMILY', message: 'Та аль хэдийн гэр бүлд харьяалагддаг.' },
    });
    expect(custom.message).toBe('Та аль хэдийн гэр бүлд харьяалагддаг.');
    expect(ApiError.client('NETWORK_ERROR').isNetwork).toBe(true);
  });
});
