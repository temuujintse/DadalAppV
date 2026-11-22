/**
 * Habit analytics computed by the backend (pure, unit tested). The AI only explains these
 * numbers; `numbersAllowed` lets the orchestrator reject an insight that invents figures.
 */
import { addDays } from '../../common/utils/local-date';

export type PeriodType = 'WEEKLY' | 'MONTHLY';

export interface Period {
  type: PeriodType;
  key: string;
  from: string;
  to: string;
}

export interface MetricHabit {
  id: string;
  title: string;
  scheduleDays: number[];
  startDate: string;
  endDate: string | null;
}

export interface MetricCompletion {
  habitId: string;
  localDate: string;
}

export interface PeriodTotals {
  scheduled: number;
  completed: number;
  completionRate: number;
}

export interface HabitMetrics extends PeriodTotals {
  periodType: PeriodType;
  periodKey: string;
  from: string;
  to: string;
  activeHabits: number;
  previous: PeriodTotals;
  rateChange: number;
  bestHabit: { title: string; completionRate: number } | null;
  leastConsistentHabit: { title: string; completionRate: number } | null;
  averageCurrentStreak: number;
  /** Completions per weekday, index 0 = Sunday … 6 = Saturday */
  byWeekday: number[];
}

const weekday = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

/** Last complete Monday–Sunday week, and last complete calendar month, before `today`. */
export function lastCompletePeriod(type: PeriodType, today: string): Period {
  if (type === 'WEEKLY') {
    const thisMonday = addDays(today, -((weekday(today) + 6) % 7));
    const from = addDays(thisMonday, -7);
    return { type, key: `W${from}`, from, to: addDays(from, 6) };
  }
  const [y, m] = today.split('-').map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  const month = `${prevY}-${String(prevM).padStart(2, '0')}`;
  const firstThisMonth = `${today.slice(0, 7)}-01`;
  return { type, key: `M${month}`, from: `${month}-01`, to: addDays(firstThisMonth, -1) };
}

/** The period right before `p`, of the same type. */
export function previousPeriod(p: Period): Period {
  return lastCompletePeriod(p.type, p.from);
}

function totals(
  habits: readonly MetricHabit[],
  done: Set<string>,
  from: string,
  to: string,
): { all: PeriodTotals; perHabit: Map<string, PeriodTotals> } {
  const perHabit = new Map<string, PeriodTotals>();
  let scheduled = 0;
  let completed = 0;
  for (const h of habits) {
    const days = new Set(h.scheduleDays);
    let s = 0;
    let c = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) {
      if (d < h.startDate || (h.endDate && d > h.endDate) || !days.has(weekday(d))) continue;
      s++;
      if (done.has(`${h.id}|${d}`)) c++;
    }
    perHabit.set(h.id, { scheduled: s, completed: c, completionRate: rate(c, s) });
    scheduled += s;
    completed += c;
  }
  return { all: { scheduled, completed, completionRate: rate(completed, scheduled) }, perHabit };
}

const rate = (c: number, s: number) => (s ? Math.round((Math.min(c, s) / s) * 100) : 0);

export function computeMetrics(
  period: Period,
  habits: readonly MetricHabit[],
  completions: readonly MetricCompletion[],
  currentStreaks: readonly number[],
): HabitMetrics {
  const done = new Set(completions.map((c) => `${c.habitId}|${c.localDate}`));
  const prev = previousPeriod(period);
  const cur = totals(habits, done, period.from, period.to);
  const before = totals(habits, done, prev.from, prev.to);

  const ranked = habits
    .map((h) => ({ h, t: cur.perHabit.get(h.id)! }))
    .filter((x) => x.t.scheduled >= 2)
    .sort((a, b) => b.t.completionRate - a.t.completionRate || a.h.title.localeCompare(b.h.title));
  const best = ranked[0];
  const worst = ranked.length > 1 ? ranked[ranked.length - 1] : undefined;

  const byWeekday = [0, 0, 0, 0, 0, 0, 0];
  for (const c of completions) {
    if (c.localDate >= period.from && c.localDate <= period.to) byWeekday[weekday(c.localDate)]++;
  }

  return {
    periodType: period.type,
    periodKey: period.key,
    from: period.from,
    to: period.to,
    activeHabits: habits.length,
    ...cur.all,
    previous: before.all,
    rateChange: cur.all.completionRate - before.all.completionRate,
    bestHabit: best ? { title: best.h.title, completionRate: best.t.completionRate } : null,
    leastConsistentHabit:
      worst && worst.t.completionRate < best.t.completionRate
        ? { title: worst.h.title, completionRate: worst.t.completionRate }
        : null,
    averageCurrentStreak: currentStreaks.length
      ? Math.round(currentStreaks.reduce((s, n) => s + n, 0) / currentStreaks.length)
      : 0,
    byWeekday,
  };
}

/** Every number the insight text may mention (plus small counting words like "3 зөвлөгөө"). */
export function numbersAllowed(m: HabitMetrics): Set<string> {
  const allowed = new Set<string>(['0', '1', '2', '3', '4', '5', '7', '30']);
  const add = (v: unknown) => {
    if (typeof v === 'number') {
      allowed.add(String(v));
      allowed.add(String(Math.abs(v)));
    } else if (typeof v === 'string') {
      for (const n of v.match(/\d+/g) ?? []) allowed.add(String(Number(n)));
    } else if (v && typeof v === 'object') {
      Object.values(v).forEach(add);
    }
  };
  add(m);
  return allowed;
}

/** Numbers in `texts` that are not in the metrics. */
export function inventedNumbers(texts: readonly string[], allowed: Set<string>): string[] {
  const found = texts.flatMap((t) => t.match(/\d+(?:[.,]\d+)?/g) ?? []);
  return found.filter((n) => !allowed.has(String(Number(n.replace(',', '.')))));
}
