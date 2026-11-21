import { startConnectivity } from './connectivity';
import { startQueryPersistence } from './query-persist';
import { startSyncEngine } from './sync-engine';

/**
 * Starts offline mode: connectivity tracking, response cache persistence and the sync engine.
 * Call once, before the session bootstrap, so the first responses are persisted too.
 */
export function startOfflineEngine(): () => void {
  const stops = [startConnectivity(), startQueryPersistence(), startSyncEngine()];
  return () => stops.forEach((stop) => stop());
}
