/**
 * Pure offline/sync rules (no I/O), so they can be unit tested.
 * The server stays the authority: nothing here grants XP, it only decides what the UI shows
 * while an action waits in the queue and how the queue retries.
 */
import type { Habit, PetCareType, SyncOperationResult, SyncOperationType } from '@/types/api';

export interface CompletionPayload {
  habitId: string;
  localDate: string;
  idempotencyKey: string;
}
/** habitId is client-side context only (the server ignores unknown keys). */
export interface UndoPayload {
  completionId: string;
  habitId: string;
}
export interface CarePayload {
  type: PetCareType;
  idempotencyKey: string;
}

interface OpBase {
  operationId: string;
  /** Client clock, ISO. The server applies a batch in this order. */
  createdAt: string;
  attempts: number;
  /** Epoch ms; 0 = ready now. */
  nextAttemptAt: number;
  lastError: string | null;
  /** Human label for the queue and conflict list ("Ном унших", "Хооллох"). */
  label: string;
}

export type QueuedOp =
  | (OpBase & { type: 'HABIT_COMPLETION'; payload: CompletionPayload })
  | (OpBase & { type: 'COMPLETION_UNDO'; payload: UndoPayload })
  | (OpBase & { type: 'PET_CARE'; payload: CarePayload });

export interface SyncIssue {
  operationId: string;
  type: SyncOperationType;
  status: 'REJECTED' | 'CONFLICT';
  errorCode: string | null;
  message: string;
  label: string;
  createdAt: string;
  resolvedAt: string;
  seen: boolean;
}

/** Server-side failures (5xx) before an operation is given up and reported to the user. */
export const MAX_ATTEMPTS = 12;
export const SYNC_BATCH_SIZE = 50;

/** Exponential backoff with ±20% jitter: ~2s, 4s, 8s … capped at 5 minutes. */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(2_000 * 2 ** Math.max(0, attempts - 1), 300_000);
  return Math.round(base * (0.8 + random() * 0.4));
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Device-local calendar day, "YYYY-MM-DD". */
export function localDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 0 = Sunday … 6 = Saturday, same convention as the backend schedule. */
export function weekdayOfKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** What a sync result means for the local queue. */
export function classifyResult(
  result: Pick<SyncOperationResult, 'status' | 'errorCode' | 'type'> | undefined,
): 'done' | 'issue' | 'retry' {
  if (!result) return 'retry';
  if (result.status === 'PROCESSED') return 'done';
  // An undo whose completion is already gone (e.g. the online undo did reach the server
  // before the connection dropped) has nothing left to do.
  if (result.type === 'COMPLETION_UNDO' && result.errorCode === 'COMPLETION_NOT_FOUND') {
    return 'done';
  }
  if (result.status === 'REJECTED' || result.status === 'CONFLICT') return 'issue';
  return 'retry';
}

export interface RewardTotals {
  personalXP: number;
  familyXP: number;
  petXP: number;
}

/** XP the server actually granted (or took back) for a synced batch. */
export function summarizeRewards(results: readonly SyncOperationResult[]): RewardTotals {
  const totals: RewardTotals = { personalXP: 0, familyXP: 0, petXP: 0 };
  for (const r of results) {
    if (r.status !== 'PROCESSED' || !r.data) continue;
    if (r.type === 'PET_CARE') {
      totals.petXP += Number(r.data.petXP ?? 0);
      continue;
    }
    const rewards = r.data.rewards as Partial<RewardTotals> | undefined;
    totals.personalXP += Number(rewards?.personalXP ?? 0);
    totals.familyXP += Number(rewards?.familyXP ?? 0);
    totals.petXP += Number(rewards?.petXP ?? 0);
  }
  return totals;
}

/**
 * Habit as the user should see it: cached server state, rolled over to the device's today
 * when the cache is from an earlier day, plus actions still waiting in the queue.
 */
export function overlayHabit<T extends Habit>(
  habit: T,
  pending: readonly QueuedOp[],
  today: string,
): T {
  let t = habit.today;
  if (t.date !== today) {
    const inRange = habit.startDate <= today && (!habit.endDate || habit.endDate >= today);
    t = {
      date: today,
      isScheduled: inRange && habit.scheduleDays.includes(weekdayOfKey(today)),
      isCompleted: false,
      completionId: null,
      completedBy: null,
      canUndo: false,
    };
  }

  let pendingSync = false;
  for (const op of pending) {
    if (op.type === 'PET_CARE' || op.payload.habitId !== habit.id) continue;
    if (op.type === 'HABIT_COMPLETION' && op.payload.localDate === today) {
      // A queued completion can be cancelled locally until it is sent.
      t = { ...t, isCompleted: true, completionId: null, completedBy: null, canUndo: true };
      pendingSync = true;
    } else if (op.type === 'COMPLETION_UNDO' && op.payload.completionId === t.completionId) {
      t = { ...t, isCompleted: false, completionId: null, completedBy: null, canUndo: false };
      pendingSync = true;
    }
  }

  if (t === habit.today && !pendingSync) return habit;
  return { ...habit, today: t, pendingSync };
}

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function base64UrlDecode(input: string): string {
  let buffer = 0;
  let bits = 0;
  let out = '';
  for (const ch of input.replace(/=+$/, '')) {
    const idx = B64URL.indexOf(ch === '+' ? '-' : ch === '/' ? '_' : ch);
    if (idx < 0) throw new Error('invalid base64url');
    buffer = ((buffer << 6) | idx) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += `%${((buffer >> bits) & 0xff).toString(16).padStart(2, '0')}`;
    }
  }
  return decodeURIComponent(out);
}

/**
 * User id (`sub`) from an access token, used only to keep each user's offline data apart.
 * Not a security check: the server verifies every token.
 */
export function decodeJwtSub(token: string | null | undefined): string | null {
  const part = token?.split('.')[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(part)) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
