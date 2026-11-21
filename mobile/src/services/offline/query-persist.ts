import type { Query, QueryKey } from '@tanstack/react-query';
import { queryClient } from '@/services/query-client';
import { getDb } from './db';

/**
 * Persists successful query results to SQLite per user, and restores them at app start, so
 * every screen the user has seen keeps working offline. Writes are batched (1s) and only
 * newer data ever replaces what is already in memory.
 */
const WRITE_DELAY_MS = 1_000;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

/** Not worth keeping on disk: short-lived invite codes. */
const SKIP: QueryKey[] = [['family', 'invites']];

const skipped = (key: QueryKey) =>
  SKIP.some((prefix) => prefix.every((part, i) => key[i] === part));

let userId: string | null = null;
let hydrating = false;
const dirty = new Map<string, Query>();
let writeTimer: ReturnType<typeof setTimeout> | null = null;

async function writeDirty(): Promise<void> {
  writeTimer = null;
  const owner = userId;
  const queries = [...dirty.values()];
  dirty.clear();
  if (!owner || !queries.length) return;
  try {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      for (const q of queries) {
        if (q.state.data === undefined) continue;
        await tx.runAsync(
          `INSERT OR REPLACE INTO query_cache (user_id, query_hash, query_key, data, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            owner,
            q.queryHash,
            JSON.stringify(q.queryKey),
            JSON.stringify(q.state.data),
            q.state.dataUpdatedAt,
          ],
        );
      }
    });
  } catch (err) {
    console.warn('[offline] cache write failed', err);
  }
}

/** Subscribes to the query cache. Call once at app start. */
export function startQueryPersistence(): () => void {
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (hydrating || !userId || skipped(event.query.queryKey)) return;
    dirty.set(event.query.queryHash, event.query);
    writeTimer ??= setTimeout(() => void writeDirty(), WRITE_DELAY_MS);
  });
  return () => {
    unsubscribe();
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = null;
  };
}

/** Restores a user's cached responses into the query client. */
export async function hydrateQueries(owner: string): Promise<void> {
  userId = owner;
  const db = await getDb();
  await db.runAsync('DELETE FROM query_cache WHERE updated_at < ?', [Date.now() - MAX_AGE_MS]);
  const rows = await db.getAllAsync<{ query_key: string; data: string; updated_at: number }>(
    'SELECT query_key, data, updated_at FROM query_cache WHERE user_id = ?',
    [owner],
  );
  hydrating = true;
  try {
    for (const row of rows) {
      const key = JSON.parse(row.query_key) as QueryKey;
      const current = queryClient.getQueryState(key);
      if (current?.dataUpdatedAt && current.dataUpdatedAt >= row.updated_at) continue;
      queryClient.setQueryData(key, JSON.parse(row.data) as unknown, {
        updatedAt: row.updated_at,
      });
    }
  } finally {
    hydrating = false;
  }
}

/** Sign-out: stop writing and delete this user's cached responses from the device. */
export async function forgetQueries(owner: string): Promise<void> {
  if (userId === owner) userId = null;
  dirty.clear();
  const db = await getDb();
  await db.runAsync('DELETE FROM query_cache WHERE user_id = ?', [owner]);
}
