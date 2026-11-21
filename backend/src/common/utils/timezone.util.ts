import { registerDecorator, ValidationOptions } from 'class-validator';

export const DEFAULT_TIMEZONE = 'Asia/Ulaanbaatar';

export function isValidTimeZone(tz: string): boolean {
  if (!tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Local calendar date ("YYYY-MM-DD") of `instant` in the given IANA timezone. */
export function localDateString(timeZone: string, instant: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** class-validator decorator for IANA timezone names. */
export function IsTimeZone(options?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isTimeZone',
      target: object.constructor,
      propertyName,
      options: { message: `${propertyName} must be a valid IANA timezone`, ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && isValidTimeZone(value),
      },
    });
}

/** Offset (minutes) of `timeZone` from UTC at `instant`, e.g. +480 for Asia/Ulaanbaatar. */
export function timeZoneOffsetMinutes(timeZone: string, instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
  }).formatToParts(instant);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === '-' ? -minutes : minutes;
}

/** UTC instant of local midnight of `localDate` ("YYYY-MM-DD") in `timeZone`. */
export function zonedMidnightUtc(localDate: string, timeZone: string): Date {
  const naiveUtc = new Date(`${localDate}T00:00:00.000Z`);
  const offset = timeZoneOffsetMinutes(timeZone, naiveUtc);
  const guess = new Date(naiveUtc.getTime() - offset * 60_000);
  // Re-check once in case the offset differs at the real instant (DST boundary).
  const corrected = timeZoneOffsetMinutes(timeZone, guess);
  return corrected === offset ? guess : new Date(naiveUtc.getTime() - corrected * 60_000);
}
