/**
 * Helpers for timezone-free "local calendar dates" ("YYYY-MM-DD").
 * PostgreSQL DATE columns arrive from Prisma as JS Dates at 00:00 UTC, so all arithmetic is done
 * in UTC on purpose — it never shifts the calendar day.
 */
const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isLocalDate(value: string): boolean {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** "2026-11-21" → Date at 2026-11-21T00:00:00Z (what Prisma expects for @db.Date). */
export function toDbDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`);
}

/** Prisma @db.Date value → "YYYY-MM-DD". */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(localDate: string, days: number): string {
  const d = toDbDate(localDate);
  d.setUTCDate(d.getUTCDate() + days);
  return fromDbDate(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(localDate: string): number {
  return toDbDate(localDate).getUTCDay();
}

/** First and last day of a "YYYY-MM" month. */
export function monthBounds(month: string): { first: string; last: string } {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { first, last: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function minDate(a: string, b: string): string {
  return a <= b ? a : b;
}

export function maxDate(a: string, b: string): string {
  return a >= b ? a : b;
}
