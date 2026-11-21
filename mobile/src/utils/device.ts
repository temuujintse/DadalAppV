import { getCalendars } from 'expo-localization';

export const FALLBACK_TIMEZONE = 'Asia/Ulaanbaatar';

/** Device IANA timezone (used for the user's local calendar day). */
export function deviceTimeZone(): string {
  try {
    return getCalendars()[0]?.timeZone ?? FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}
