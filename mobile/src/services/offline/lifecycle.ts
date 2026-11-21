import { loadOutbox, resetOutbox } from './outbox';
import { forgetQueries, hydrateQueries } from './query-persist';

/**
 * Per-user offline data, driven by the session store. Failures are logged, never fatal:
 * the app still works online if the local database is unavailable.
 */
export async function prepareOfflineUser(userId: string): Promise<void> {
  try {
    await hydrateQueries(userId);
    await loadOutbox(userId);
  } catch (err) {
    console.warn('[offline] could not load local data', err);
  }
}

export async function forgetOfflineUser(userId: string): Promise<void> {
  resetOutbox();
  try {
    await forgetQueries(userId);
  } catch (err) {
    console.warn('[offline] could not clear local cache', err);
  }
}
