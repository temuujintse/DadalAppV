/**
 * Day-plan validation (pure, unit tested). The model proposes times; the backend decides what
 * is acceptable: only today's open habits, inside the user's window, no overlaps, and an honest
 * warning when the plan does not fit the available time.
 */

export interface PlanCandidate {
  /** Short reference given to the model instead of a database id ("h1", "h2", …). */
  ref: string;
  habitId: string;
  title: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  reminderTime: string | null;
}

export interface RawPlanItem {
  ref: string;
  startTime: string;
  durationMinutes: number;
  note: string;
}

export interface PlannedItem {
  habitId: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  order: number;
  note: string | null;
}

export type PlanWarningCode = 'OVERLOAD' | 'CONFLICT_RESOLVED' | 'NOT_PLANNED' | 'OUTSIDE_WINDOW';

export interface PlanWarning {
  code: PlanWarningCode;
  message: string;
}

export interface PlanWindow {
  /** "HH:mm" */
  from: string;
  to: string;
}

export const MIN_ITEM_MINUTES = 5;
export const MAX_ITEM_MINUTES = 120;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Rounds a local time up to the next 5 minutes ("09:02" → "09:05"). */
export function roundUpTo5(hhmm: string): string {
  return fromMinutes(Math.min(23 * 60 + 55, Math.ceil(toMinutes(hhmm) / 5) * 5));
}

/** Default effort per difficulty when the model gives nothing usable. */
export const DEFAULT_MINUTES = { EASY: 10, MEDIUM: 20, HARD: 30 } as const;

export function validatePlan(
  raw: readonly RawPlanItem[],
  candidates: readonly PlanCandidate[],
  window: PlanWindow,
  availableMinutes: number | null,
): { items: PlannedItem[]; warnings: PlanWarning[] } {
  const byRef = new Map(candidates.map((c) => [c.ref, c]));
  const from = toMinutes(window.from);
  const to = toMinutes(window.to);
  const warnings: PlanWarning[] = [];
  const seen = new Set<string>();
  let outside = 0;

  const accepted = raw
    .filter((r) => {
      const c = byRef.get(r.ref);
      if (!c || seen.has(c.habitId) || !HHMM.test(r.startTime)) return false;
      seen.add(c.habitId);
      return true;
    })
    .map((r) => ({
      c: byRef.get(r.ref)!,
      start: toMinutes(r.startTime),
      duration: Math.max(
        MIN_ITEM_MINUTES,
        Math.min(MAX_ITEM_MINUTES, Math.round(r.durationMinutes) || 0),
      ),
      note: r.note.trim().slice(0, 200) || null,
    }))
    .sort((a, b) => a.start - b.start);

  const items: PlannedItem[] = [];
  let cursor = from;
  let conflicts = 0;
  for (const a of accepted) {
    let start = Math.max(a.start, from);
    if (start < cursor) {
      start = cursor; // overlap: move after the previous item
      conflicts++;
    }
    if (start + a.duration > to) {
      outside++;
      seen.delete(a.c.habitId);
      continue;
    }
    items.push({
      habitId: a.c.habitId,
      title: a.c.title,
      startTime: fromMinutes(start),
      durationMinutes: a.duration,
      order: items.length,
      note: a.note,
    });
    cursor = start + a.duration;
  }

  if (conflicts) {
    warnings.push({
      code: 'CONFLICT_RESOLVED',
      message: `${conflicts} дадлын цаг давхцаж байсныг дараалуулж зөөлөө.`,
    });
  }
  if (outside) {
    warnings.push({
      code: 'OUTSIDE_WINDOW',
      message: `${outside} дадал таны боломжит цагт багтсангүй.`,
    });
  }
  const missing = candidates.filter((c) => !items.some((i) => i.habitId === c.habitId));
  if (missing.length) {
    warnings.push({
      code: 'NOT_PLANNED',
      message: `Төлөвлөгөөнд ороогүй: ${missing.map((m) => m.title).join(', ')}.`,
    });
  }
  const total = items.reduce((s, i) => s + i.durationMinutes, 0);
  if (availableMinutes !== null && total > availableMinutes) {
    warnings.push({
      code: 'OVERLOAD',
      message: `Нийт ${total} минут — таны өдрийн ${availableMinutes} минутаас их байна. Заримыг нь өөр өдөр шилжүүлэхийг бодоорой.`,
    });
  }
  return { items, warnings };
}
