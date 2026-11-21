import {
  hmacSha256,
  normalizeHumanCode,
  randomHumanCode,
  safeEqualHex,
  sha256,
} from './crypto.util';
import {
  isValidTimeZone,
  localDateString,
  timeZoneOffsetMinutes,
  zonedMidnightUtc,
} from './timezone.util';

describe('crypto.util', () => {
  it('generates grouped human codes from the unambiguous alphabet', () => {
    const code = randomHumanCode(10, 5);
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/);
  });

  it('produces different codes on each call', () => {
    const codes = new Set(Array.from({ length: 200 }, () => randomHumanCode()));
    expect(codes.size).toBe(200);
  });

  it('normalises user input (case, dashes, spaces, look-alikes)', () => {
    expect(normalizeHumanCode(' 7kq2m-x9dpa ')).toBe('7KQ2MX9DPA');
    expect(normalizeHumanCode('o0-il')).toBe('0011');
  });

  it('round-trips a generated code through normalisation', () => {
    const code = randomHumanCode();
    expect(normalizeHumanCode(code.toLowerCase())).toBe(code.replace('-', ''));
  });

  it('keys HMAC by secret', () => {
    expect(hmacSha256('a'.repeat(32), 'X')).not.toBe(hmacSha256('b'.repeat(32), 'X'));
    expect(hmacSha256('a'.repeat(32), 'X')).toBe(hmacSha256('a'.repeat(32), 'X'));
  });

  it('compares digests safely', () => {
    expect(safeEqualHex(sha256('a'), sha256('a'))).toBe(true);
    expect(safeEqualHex(sha256('a'), sha256('b'))).toBe(false);
    expect(safeEqualHex(sha256('a'), 'abcd')).toBe(false);
  });
});

describe('timezone.util', () => {
  it('validates IANA timezones', () => {
    expect(isValidTimeZone('Asia/Ulaanbaatar')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });

  it('computes the local calendar date across the day boundary', () => {
    // 2026-11-21 17:30 UTC = 2026-11-22 01:30 in Ulaanbaatar (UTC+8)
    const instant = new Date('2026-11-21T17:30:00Z');
    expect(localDateString('Asia/Ulaanbaatar', instant)).toBe('2026-11-22');
    expect(localDateString('UTC', instant)).toBe('2026-11-21');
    expect(localDateString('America/Los_Angeles', instant)).toBe('2026-11-21');
  });
});

describe('zoned midnight', () => {
  it('reads IANA offsets', () => {
    expect(timeZoneOffsetMinutes('Asia/Ulaanbaatar', new Date('2026-11-21T00:00:00Z'))).toBe(480);
    expect(timeZoneOffsetMinutes('UTC', new Date('2026-11-21T00:00:00Z'))).toBe(0);
  });

  it('converts local midnight to the UTC instant', () => {
    expect(zonedMidnightUtc('2026-11-16', 'Asia/Ulaanbaatar').toISOString()).toBe(
      '2026-11-15T16:00:00.000Z',
    );
    expect(zonedMidnightUtc('2026-07-01', 'America/New_York').toISOString()).toBe(
      '2026-07-01T04:00:00.000Z',
    );
  });
});
