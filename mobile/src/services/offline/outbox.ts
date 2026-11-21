import { create } from 'zustand';
import type { SyncOperationType } from '@/types/api';
import { getDb, getMeta, setMeta } from './db';
import type { QueuedOp, SyncIssue } from './logic';

/**
 * Offline outbox. SQLite is the durable copy; this store mirrors the current user's rows so
 * screens re-render as actions are queued, synced or rejected.
 */
interface OutboxState {
  userId: string | null;
  pending: QueuedOp[];
  issues: SyncIssue[];
  syncing: boolean;
  lastSyncAt: string | null;
}

const EMPTY: OutboxState = {
  userId: null,
  pending: [],
  issues: [],
  syncing: false,
  lastSyncAt: null,
};

export const useOutboxStore = create<OutboxState>(() => EMPTY);

const ISSUE_LIMIT = 50;
const byCreated = (a: { createdAt: string }, b: { createdAt: string }) =>
  a.createdAt.localeCompare(b.createdAt);

interface OutboxRow {
  operation_id: string;
  type: SyncOperationType;
  payload: string;
  label: string;
  created_at: string;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
}

interface IssueRow {
  operation_id: string;
  type: SyncOperationType;
  status: 'REJECTED' | 'CONFLICT';
  error_code: string | null;
  message: string;
  label: string;
  created_at: string;
  resolved_at: string;
  seen: number;
}

const fromRow = (r: OutboxRow): QueuedOp =>
  ({
    operationId: r.operation_id,
    type: r.type,
    payload: JSON.parse(r.payload) as QueuedOp['payload'],
    label: r.label,
    createdAt: r.created_at,
    attempts: r.attempts,
    nextAttemptAt: r.next_attempt_at,
    lastError: r.last_error,
  }) as QueuedOp;

const issueFromRow = (r: IssueRow): SyncIssue => ({
  operationId: r.operation_id,
  type: r.type,
  status: r.status,
  errorCode: r.error_code,
  message: r.message,
  label: r.label,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
  seen: r.seen === 1,
});

const lastSyncKey = (userId: string) => `lastSyncAt:${userId}`;

/** Loads a user's queue into memory (app start / sign-in). */
export async function loadOutbox(userId: string): Promise<void> {
  const db = await getDb();
  const [rows, issues, lastSyncAt] = [
    await db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox WHERE user_id = ? ORDER BY created_at ASC',
      [userId],
    ),
    await db.getAllAsync<IssueRow>(
      'SELECT * FROM sync_issues WHERE user_id = ? ORDER BY resolved_at DESC LIMIT ?',
      [userId, ISSUE_LIMIT],
    ),
    await getMeta(lastSyncKey(userId)),
  ];
  useOutboxStore.setState({
    userId,
    pending: rows.map(fromRow),
    issues: issues.map(issueFromRow),
    syncing: false,
    lastSyncAt,
  });
}

/** Forgets the in-memory mirror (sign-out). Queued rows stay on disk for that user. */
export function resetOutbox(): void {
  useOutboxStore.setState(EMPTY);
}

export async function insertOp(userId: string, op: QueuedOp): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO outbox
       (operation_id, user_id, type, payload, label, created_at, attempts, next_attempt_at, last_error)
     VALUES (?, ?, ?, ?, ?, ?, 0, 0, NULL)`,
    [op.operationId, userId, op.type, JSON.stringify(op.payload), op.label, op.createdAt],
  );
  if (useOutboxStore.getState().userId !== userId) return;
  useOutboxStore.setState((s) => ({ pending: [...s.pending, op].sort(byCreated) }));
}

export async function removeOps(userId: string, operationIds: readonly string[]): Promise<void> {
  if (!operationIds.length) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const id of operationIds) {
      await tx.runAsync('DELETE FROM outbox WHERE user_id = ? AND operation_id = ?', [userId, id]);
    }
  });
  const gone = new Set(operationIds);
  useOutboxStore.setState((s) => ({ pending: s.pending.filter((p) => !gone.has(p.operationId)) }));
}

export interface Deferral {
  operationId: string;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export async function deferOps(userId: string, deferrals: readonly Deferral[]): Promise<void> {
  if (!deferrals.length) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const d of deferrals) {
      await tx.runAsync(
        `UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ?
         WHERE user_id = ? AND operation_id = ?`,
        [d.attempts, d.nextAttemptAt, d.lastError, userId, d.operationId],
      );
    }
  });
  const map = new Map(deferrals.map((d) => [d.operationId, d]));
  useOutboxStore.setState((s) => ({
    pending: s.pending.map((p) => {
      const d = map.get(p.operationId);
      return d ? { ...p, ...d } : p;
    }),
  }));
}

/** Moves finished-with-a-problem operations out of the queue into the issue list. */
export async function resolveAsIssues(userId: string, issues: readonly SyncIssue[]): Promise<void> {
  if (!issues.length) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const i of issues) {
      await tx.runAsync('DELETE FROM outbox WHERE user_id = ? AND operation_id = ?', [
        userId,
        i.operationId,
      ]);
      await tx.runAsync(
        `INSERT OR REPLACE INTO sync_issues
           (operation_id, user_id, type, status, error_code, message, label, created_at, resolved_at, seen)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          i.operationId,
          userId,
          i.type,
          i.status,
          i.errorCode,
          i.message,
          i.label,
          i.createdAt,
          i.resolvedAt,
        ],
      );
    }
    await tx.runAsync(
      `DELETE FROM sync_issues WHERE user_id = ? AND operation_id NOT IN (
         SELECT operation_id FROM sync_issues WHERE user_id = ? ORDER BY resolved_at DESC LIMIT ?
       )`,
      [userId, userId, ISSUE_LIMIT],
    );
  });
  const gone = new Set(issues.map((i) => i.operationId));
  useOutboxStore.setState((s) => ({
    pending: s.pending.filter((p) => !gone.has(p.operationId)),
    issues: [...issues, ...s.issues.filter((i) => !gone.has(i.operationId))].slice(0, ISSUE_LIMIT),
  }));
}

export async function markIssuesSeen(userId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sync_issues SET seen = 1 WHERE user_id = ? AND seen = 0', [userId]);
  useOutboxStore.setState((s) => ({ issues: s.issues.map((i) => ({ ...i, seen: true })) }));
}

export async function clearIssues(userId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM sync_issues WHERE user_id = ?', [userId]);
  useOutboxStore.setState({ issues: [] });
}

export async function recordSyncTime(userId: string, iso: string): Promise<void> {
  await setMeta(lastSyncKey(userId), iso);
  if (useOutboxStore.getState().userId === userId) useOutboxStore.setState({ lastSyncAt: iso });
}

export function setSyncing(syncing: boolean): void {
  useOutboxStore.setState({ syncing });
}

/** Operations ready to send now, oldest first. */
export function readyOps(now: number, limit: number): QueuedOp[] {
  return useOutboxStore
    .getState()
    .pending.filter((p) => p.nextAttemptAt <= now)
    .slice(0, limit);
}

// ── Selectors ──
export const selectPendingCount = (s: OutboxState) => s.pending.length;
export const selectUnseenIssues = (s: OutboxState) => s.issues.filter((i) => !i.seen).length;
