import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { markIssuesSeen, clearIssues, useOutboxStore } from '@/services/offline/outbox';
import { queryKeys } from '@/services/query-client';
import { useSessionStore } from '@/store/session.store';
import type { SyncStatus } from '@/types/api';

/** Server-side view of this user's synced operations (GET /sync/status). */
export function useServerSyncStatus() {
  return useQuery({
    queryKey: queryKeys.syncStatus,
    queryFn: () => api.get<SyncStatus>('/sync/status'),
  });
}

const withUser = (fn: (userId: string) => Promise<void>) => () => {
  const userId = useSessionStore.getState().userId;
  if (userId) void fn(userId).catch(() => undefined);
};

export const acknowledgeIssues = withUser(markIssuesSeen);
export const clearSyncIssues = withUser(clearIssues);

export const useSyncIssues = () => useOutboxStore((s) => s.issues);
