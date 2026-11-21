import * as SQLite from 'expo-sqlite';

/**
 * Local SQLite store for offline mode:
 *   outbox       — actions waiting to be synced (survive app restarts)
 *   sync_issues  — rejected / conflicting actions with the server's explanation
 *   query_cache  — last known server responses, so screens work without a connection
 *   meta         — small per-user values (last sync time)
 * Every row carries user_id so two accounts on one device never see each other's data.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE IF NOT EXISTS outbox (
    operation_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    last_error TEXT
  );
  CREATE INDEX IF NOT EXISTS outbox_user_created ON outbox (user_id, created_at);
  CREATE TABLE IF NOT EXISTS sync_issues (
    operation_id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    error_code TEXT,
    message TEXT NOT NULL,
    label TEXT NOT NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT NOT NULL,
    seen INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS sync_issues_user ON sync_issues (user_id, resolved_at);
  CREATE TABLE IF NOT EXISTS query_cache (
    user_id TEXT NOT NULL,
    query_hash TEXT NOT NULL,
    query_key TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, query_hash)
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('family-habit.db');
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const next = version + 1;
    await db.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(MIGRATIONS[version]);
      await tx.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
  return db;
}

/** Lazily opened, shared connection. A failed open is retried on the next call. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((err: unknown) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
}
