/**
 * Mongolian date helpers. Implemented by hand instead of Intl month names because
 * Hermes/ICU builds differ in "mn" locale coverage across devices.
 */
const WEEKDAYS = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

/** "11-р сарын 21, Бямба" */
export function formatLongDate(date: Date): string {
  return `${date.getMonth() + 1}-р сарын ${date.getDate()}, ${WEEKDAYS[date.getDay()]}`;
}

/** Time-of-day greeting. */
export function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return 'Сайн байна уу';
  if (h < 12) return 'Өглөөний мэнд';
  if (h < 18) return 'Өдрийн мэнд';
  return 'Оройн мэнд';
}

/** Relative expiry for invites: "2 өдөр", "5 цаг", "30 минут". */
export function formatTimeLeft(iso: string, now: Date = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return 'дууссан';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${Math.max(1, minutes)} минут`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} цаг`;
  // Round days so a fresh 72-hour invite reads "3 өдөр", not "2 өдөр".
  return `${Math.round(hours / 24)} өдөр`;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "14:05" for today, "11/20 14:05" otherwise. */
export function formatClock(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`;
}
