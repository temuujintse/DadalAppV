import { randomUUID } from 'expo-crypto';
import { AppState } from 'react-native';
import { api } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { queryClient, queryKeys } from '@/services/query-client';
import { useCelebrationStore } from '@/store/celebration.store';
import { useSessionStore } from '@/store/session.store';
import type { MyGamification, SyncPull, SyncPushResult } from '@/types/api';
import { isOnline, useConnectivity } from './connectivity';
import {
  backoffMs,
  classifyResult,
  MAX_ATTEMPTS,
  QueuedOp,
  summarizeRewards,
  SYNC_BATCH_SIZE,
  SyncIssue,
} from './logic';
import {
  deferOps,
  Deferral,
  insertOp,
  readyOps,
  recordSyncTime,
  removeOps,
  resolveAsIssues,
  setSyncing,
  useOutboxStore,
} from './outbox';

/**
 * Sync engine: sends queued actions to POST /sync/push in batches.
 *   PROCESSED            → removed from the queue (XP is shown only now, from the server)
 *   REJECTED / CONFLICT  → removed and listed with the server's explanation
 *   FAILED / 5xx         → kept, retried with exponential backoff (given up after MAX_ATTEMPTS)
 *   network error        → stop; resumes when the connection returns
 * After a sync that changed anything it reconciles with GET /sync/pull and refetches.
 */
const MAX_ROUNDS = 10;

let running: Promise<void> | null = null;
let runAgain = false;
let reconcileWanted = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

const currentUser = (): string | null => {
  const { status, userId } = useSessionStore.getState();
  return status === 'signedIn' ? userId : null;
};

type NewOp = Pick<QueuedOp, 'type' | 'payload' | 'label'>;

/** Adds an action to the offline queue and tries to send it right away. */
export async function queueOperation(op: NewOp): Promise<QueuedOp> {
  const userId = currentUser();
  if (!userId) throw ApiError.client('SESSION_EXPIRED');
  const queued = {
    ...op,
    operationId: randomUUID(),
    createdAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
  } as QueuedOp;
  await insertOp(userId, queued);
  void requestSync();
  return queued;
}

/** Cancels a queued action that has not been sent yet. Returns false if it already left. */
export async function cancelQueued(predicate: (op: QueuedOp) => boolean): Promise<boolean> {
  await whenSyncIdle();
  const userId = currentUser();
  const op = useOutboxStore.getState().pending.find(predicate);
  if (!userId || !op) return false;
  await removeOps(userId, [op.operationId]);
  return true;
}

export function whenSyncIdle(): Promise<void> {
  return running ?? Promise.resolve();
}

/** Single-flight sync. Calls during a run schedule one more pass. */
export function requestSync(opts: { reconcile?: boolean } = {}): Promise<void> {
  if (opts.reconcile) reconcileWanted = true;
  if (running) {
    runAgain = true;
    return running;
  }
  running = (async () => {
    do {
      runAgain = false;
      await syncOnce();
    } while (runAgain);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce(): Promise<void> {
  const userId = currentUser();
  if (!userId || !isOnline() || useOutboxStore.getState().userId !== userId) return;

  const results: SyncPushResult['results'] = [];
  let changed = false;
  setSyncing(true);
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const batch = readyOps(Date.now(), SYNC_BATCH_SIZE);
      if (!batch.length) break;

      let response: SyncPushResult;
      try {
        response = await api.post<SyncPushResult>('/sync/push', {
          operations: batch.map((op) => ({
            operationId: op.operationId,
            type: op.type,
            createdAt: op.createdAt,
            payload: op.payload,
          })),
        });
      } catch (err) {
        // Offline or signed out: leave the queue untouched, a reconnect / sign-in resumes it.
        if (!(err instanceof ApiError) || err.isNetwork || err.status === 401 || err.status === 0) {
          return;
        }
        changed = (await deferAll(userId, batch, err.message)) || changed;
        break;
      }

      const byId = new Map(response.results.map((r) => [r.operationId, r]));
      const done: string[] = [];
      const issues: SyncIssue[] = [];
      const deferrals: Deferral[] = [];
      const now = new Date().toISOString();
      for (const op of batch) {
        const r = byId.get(op.operationId);
        const verdict = classifyResult(r);
        if (verdict === 'done') {
          done.push(op.operationId);
          if (r!.status === 'PROCESSED') results.push(r!);
        } else if (verdict === 'issue') {
          issues.push(toIssue(op, r!.status as SyncIssue['status'], r!.errorCode, r!.message, now));
        } else if (op.attempts + 1 >= MAX_ATTEMPTS) {
          issues.push(giveUp(op, now));
        } else {
          deferrals.push(defer(op, r?.message ?? null));
        }
      }
      await removeOps(userId, done);
      await resolveAsIssues(userId, issues);
      await deferOps(userId, deferrals);
      changed = changed || done.length > 0 || issues.length > 0;
    }
  } finally {
    setSyncing(false);
  }

  if (changed || reconcileWanted) {
    reconcileWanted = false;
    await reconcile(summarizeRewards(results));
  }
  await recordSyncTime(userId, new Date().toISOString()).catch(() => undefined);
  scheduleRetry();
}

function defer(op: QueuedOp, lastError: string | null): Deferral {
  const attempts = op.attempts + 1;
  return {
    operationId: op.operationId,
    attempts,
    nextAttemptAt: Date.now() + backoffMs(attempts),
    lastError,
  };
}

function toIssue(
  op: QueuedOp,
  status: SyncIssue['status'],
  errorCode: string | null,
  message: string | null,
  resolvedAt: string,
): SyncIssue {
  return {
    operationId: op.operationId,
    type: op.type,
    status,
    errorCode,
    message: message ?? 'Сервер энэ үйлдлийг хүлээж авсангүй.',
    label: op.label,
    createdAt: op.createdAt,
    resolvedAt,
  } as SyncIssue;
}

function giveUp(op: QueuedOp, resolvedAt: string): SyncIssue {
  return toIssue(
    op,
    'REJECTED',
    'SYNC_GAVE_UP',
    'Олон удаа оролдсон ч синк хийж чадсангүй. Дахин тэмдэглэнэ үү.',
    resolvedAt,
  );
}

/** Whole batch failed with a server error: back off every operation in it. */
async function deferAll(userId: string, batch: QueuedOp[], message: string): Promise<boolean> {
  const now = new Date().toISOString();
  const issues = batch.filter((op) => op.attempts + 1 >= MAX_ATTEMPTS).map((op) => giveUp(op, now));
  const gaveUp = new Set(issues.map((i) => i.operationId));
  await resolveAsIssues(userId, issues);
  await deferOps(
    userId,
    batch.filter((op) => !gaveUp.has(op.operationId)).map((op) => defer(op, message)),
  );
  return issues.length > 0;
}

/** Server truth after a sync: snapshot via /sync/pull, then refetch everything it touched. */
async function reconcile(totals: ReturnType<typeof summarizeRewards>): Promise<void> {
  const before = queryClient.getQueryData<MyGamification>(queryKeys.myGamification)?.level;
  const exact = new Set<string>();
  try {
    const snap = await api.get<SyncPull>('/sync/pull');
    queryClient.setQueryData(queryKeys.habitList('all:ACTIVE'), snap.habits);
    queryClient.setQueryData(queryKeys.myGamification, snap.gamification);
    exact.add(JSON.stringify(queryKeys.habitList('all:ACTIVE')));
    exact.add(JSON.stringify(queryKeys.myGamification));
    if (snap.family) {
      queryClient.setQueryData(queryKeys.family, snap.family);
      queryClient.setQueryData(queryKeys.members, snap.members);
      exact.add(JSON.stringify(queryKeys.family));
      exact.add(JSON.stringify(queryKeys.members));
    }
    const after = snap.gamification.level;
    if (before !== undefined && after > before) {
      useCelebrationStore.getState().enqueue([{ kind: 'levelUp', level: after, scope: 'personal' }]);
    }
  } catch {
    // Still refetch below; a failed pull only means slightly older data for a moment.
  }

  const notJustSet = { predicate: (q: { queryKey: readonly unknown[] }) => !exact.has(JSON.stringify(q.queryKey)) };
  await Promise.all(
    [queryKeys.habits, queryKeys.gamification, queryKeys.pet, queryKeys.quests, ['family']].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey, ...notJustSet }),
    ),
  );

  if (totals.personalXP > 0 || totals.petXP > 0 || totals.familyXP > 0) {
    useCelebrationStore.getState().showToast({
      personalXP: Math.max(0, totals.personalXP),
      familyXP: Math.max(0, totals.familyXP),
      petXP: Math.max(0, totals.petXP),
    });
  }
}

function scheduleRetry(): void {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const pending = useOutboxStore.getState().pending;
  if (!pending.length) return;
  const next = Math.min(...pending.map((p) => p.nextAttemptAt));
  const delay = Math.max(1_000, next - Date.now());
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void requestSync();
  }, delay);
}

/** Starts the triggers: reconnect, sign-in, app foreground. Call once at app start. */
export function startSyncEngine(): () => void {
  let wasOnline = isOnline();
  const stopConnectivity = useConnectivity.subscribe(() => {
    const online = isOnline();
    if (online && !wasOnline) void requestSync({ reconcile: true });
    wasOnline = online;
  });

  let lastUser = currentUser();
  const stopSession = useSessionStore.subscribe(() => {
    const user = currentUser();
    if (user && user !== lastUser) void requestSync({ reconcile: true });
    lastUser = user;
  });

  // The outbox loads asynchronously after sign-in; sync as soon as it belongs to the user.
  const stopOutbox = useOutboxStore.subscribe((s, prev) => {
    if (s.userId && s.userId !== prev.userId) void requestSync({ reconcile: true });
  });

  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active') void requestSync();
  });

  void requestSync({ reconcile: true });

  return () => {
    stopConnectivity();
    stopSession();
    stopOutbox();
    appState.remove();
    if (retryTimer) clearTimeout(retryTimer);
  };
}
