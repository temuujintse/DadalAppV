import { useMutation, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { refreshProgress } from '@/features/gamification/api';
import { useNow } from '@/hooks/useNow';
import { api } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { isOnline } from '@/services/offline/connectivity';
import { localDateKey, overlayHabit, QueuedOp } from '@/services/offline/logic';
import { useOutboxStore } from '@/services/offline/outbox';
import { cancelQueued, queueOperation } from '@/services/offline/sync-engine';
import { queryClient, queryKeys } from '@/services/query-client';
import { celebrateCompletion } from '@/store/celebration.store';
import { showNotice } from '@/store/notice.store';
import type {
  CompletionResult,
  UndoResult,
  CreateHabitBody,
  Habit,
  HabitCalendar,
  HabitDetail,
  UpdateHabitBody,
} from '@/types/api';

export type HabitScope = 'all' | 'personal' | 'family' | 'today';

/** Device "today", re-evaluated every minute so cached screens roll over at midnight. */
function useToday(): string {
  return localDateKey(useNow(60_000));
}

const usePendingOps = (): QueuedOp[] => useOutboxStore((s) => s.pending);

/**
 * Habit lists = cached server state + actions waiting in the offline queue.
 * A "today" list cached on an earlier day is rebuilt from the full list when available.
 */
export function useHabits(scope: HabitScope = 'all', status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE') {
  const pending = usePendingOps();
  const today = useToday();
  return useQuery({
    queryKey: queryKeys.habitList(`${scope}:${status}`),
    queryFn: () => api.get<Habit[]>(`/habits?scope=${scope}&status=${status}`),
    select: (list) => {
      const stale = scope === 'today' && list.length > 0 && list[0].today.date !== today;
      const source = stale
        ? (queryClient.getQueryData<Habit[]>(queryKeys.habitList('all:ACTIVE')) ?? list)
        : list;
      const shown = source.map((h) => overlayHabit(h, pending, today));
      return stale ? shown.filter((h) => h.today.isScheduled) : shown;
    },
  });
}

/** Offline fallback for a detail screen never opened before: the row from any cached list. */
function habitFromLists(id: string): HabitDetail | undefined {
  for (const [, list] of queryClient.getQueriesData<Habit[]>({ queryKey: ['habits', 'list'] })) {
    const found = list?.find((h) => h.id === id);
    if (found) return { ...found, todayByMember: null };
  }
  return undefined;
}

export function useHabit(id: string) {
  const pending = usePendingOps();
  const today = useToday();
  return useQuery({
    queryKey: queryKeys.habit(id),
    queryFn: () => api.get<HabitDetail>(`/habits/${id}`),
    placeholderData: () => habitFromLists(id),
    select: (habit) => overlayHabit(habit, pending, today),
  });
}

export function useHabitCalendar(id: string, month?: string) {
  return useQuery({
    queryKey: queryKeys.habitCalendar(id, month ?? 'current'),
    queryFn: () =>
      api.get<HabitCalendar>(`/habits/${id}/calendar${month ? `?month=${month}` : ''}`),
  });
}

/** Any habit change can affect lists, details and calendars. */
/** Habit changes can move habit lists, quests (progress) and the pet. */
function refreshHabits() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.habits }),
    queryClient.invalidateQueries({ queryKey: queryKeys.quests }),
    queryClient.invalidateQueries({ queryKey: queryKeys.pet }),
  ]);
}

export function useCreateHabit() {
  return useMutation({
    mutationFn: (body: CreateHabitBody) => api.post<HabitDetail>('/habits', body),
    onSuccess: refreshHabits,
  });
}

export function useUpdateHabit(id: string) {
  return useMutation({
    mutationFn: (body: UpdateHabitBody) => api.patch<HabitDetail>(`/habits/${id}`, body),
    onSuccess: (habit) => {
      queryClient.setQueryData(queryKeys.habit(id), habit);
      return refreshHabits();
    },
  });
}

export function useDeleteHabit() {
  return useMutation({
    mutationFn: (id: string) => api.delete<null>(`/habits/${id}`),
    onSuccess: refreshHabits,
  });
}

export function useSetAssignees(id: string) {
  return useMutation({
    mutationFn: (userIds: string[]) =>
      api.post<HabitDetail>(`/habits/${id}/assignments`, { userIds }),
    onSuccess: refreshHabits,
  });
}

type HabitLike = Habit | HabitDetail;

/** Applies `patch` to the habit wherever it is cached (lists and detail). */
function patchCachedHabit(id: string, patch: (h: HabitLike) => HabitLike) {
  queryClient.setQueriesData<Habit[]>({ queryKey: ['habits', 'list'] }, (list) =>
    list?.map((h) => (h.id === id ? (patch(h) as Habit) : h)),
  );
  queryClient.setQueryData<HabitDetail>(queryKeys.habit(id), (h) =>
    h ? (patch(h) as HabitDetail) : h,
  );
}

/** One key per user action; re-sending the same key (retry, offline sync) is idempotent. */
export const newIdempotencyKey = (): string => randomUUID();

export type CompleteOutcome = { kind: 'online'; result: CompletionResult } | { kind: 'queued' };
export type UndoOutcome =
  | { kind: 'online'; result: UndoResult }
  | { kind: 'queued' }
  | { kind: 'cancelled' };

interface CompleteVars {
  habitId: string;
  idempotencyKey: string;
  /** Habit title, shown in the sync queue and conflict list. */
  title: string;
}

interface UndoVars {
  habitId: string;
  /** null = today's completion is still in the offline queue (cancel it locally). */
  completionId: string | null;
  title: string;
}

const isNetworkError = (err: unknown) => err instanceof ApiError && err.isNetwork;

/** Records today's completion in the offline queue (once per habit and day). */
async function queueCompletion({ habitId, idempotencyKey, title }: CompleteVars) {
  const localDate = localDateKey();
  const queued = useOutboxStore
    .getState()
    .pending.some(
      (op) =>
        op.type === 'HABIT_COMPLETION' &&
        op.payload.habitId === habitId &&
        op.payload.localDate === localDate,
    );
  if (!queued) {
    await queueOperation({
      type: 'HABIT_COMPLETION',
      payload: { habitId, localDate, idempotencyKey },
      label: title,
    });
  }
  return { kind: 'queued' } as const;
}

function snapshotHabits() {
  return queryClient.getQueriesData({ queryKey: queryKeys.habits });
}
type Snapshot = ReturnType<typeof snapshotHabits>;
function restore(snapshot: Snapshot | undefined) {
  snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

/**
 * Optimistic completion: the check mark appears instantly, the server stays the authority.
 * Offline (or if the request never reaches the server) the action is queued with the same
 * idempotency key, so a request that did arrive is never counted twice. No XP is shown
 * until the server confirms it during sync.
 */
export function useCompleteHabit() {
  return useMutation({
    mutationFn: async (vars: CompleteVars): Promise<CompleteOutcome> => {
      if (!isOnline()) return queueCompletion(vars);
      try {
        const result = await api.post<CompletionResult>(`/habits/${vars.habitId}/completions`, {
          idempotencyKey: vars.idempotencyKey,
        });
        return { kind: 'online', result };
      } catch (err) {
        if (isNetworkError(err)) return queueCompletion(vars);
        throw err;
      }
    },
    onMutate: async ({ habitId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits });
      const snapshot = snapshotHabits();
      patchCachedHabit(habitId, (h) => ({
        ...h,
        today: { ...h.today, isCompleted: true, canUndo: false },
      }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => restore(ctx?.snapshot),
    onSuccess: (outcome, { habitId }, ctx) => {
      if (outcome.kind === 'queued') {
        // The queue overlay now shows it; keep the cache as pure server state.
        restore(ctx?.snapshot);
        showNotice('Офлайн хадгаллаа. Холбогдмогц синк хийж, XP нэмэгдэнэ.', 'warning');
        return;
      }
      const { result } = outcome;
      celebrateCompletion(result);
      patchCachedHabit(habitId, (h) => ({
        ...h,
        today: {
          ...h.today,
          isCompleted: true,
          completionId: result.completion.id,
          completedBy: result.completion.completedBy,
          canUndo: true,
        },
        streak: result.streak,
      }));
    },
    onSettled: (outcome) =>
      outcome?.kind === 'queued' ? undefined : Promise.all([refreshHabits(), refreshProgress()]),
  });
}

export function useUndoCompletion() {
  return useMutation({
    mutationFn: async ({ habitId, completionId, title }: UndoVars): Promise<UndoOutcome> => {
      if (!completionId) {
        const today = localDateKey();
        const cancelled = await cancelQueued(
          (op) =>
            op.type === 'HABIT_COMPLETION' &&
            op.payload.habitId === habitId &&
            op.payload.localDate === today,
        );
        if (!cancelled) {
          throw new ApiError(
            0,
            'ALREADY_SYNCED',
            'Энэ тэмдэглэгээ дөнгөж синк хийгдлээ. Хуудсаа шинэчлээд дахин буцаана уу.',
          );
        }
        return { kind: 'cancelled' };
      }
      const queue = async () => {
        await queueOperation({
          type: 'COMPLETION_UNDO',
          payload: { completionId, habitId },
          label: title,
        });
        return { kind: 'queued' } as const;
      };
      if (!isOnline()) return queue();
      try {
        return { kind: 'online', result: await api.delete<UndoResult>(`/completions/${completionId}`) };
      } catch (err) {
        if (isNetworkError(err)) return queue();
        throw err;
      }
    },
    onMutate: async ({ habitId }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.habits });
      const snapshot = snapshotHabits();
      patchCachedHabit(habitId, (h) => ({
        ...h,
        today: {
          ...h.today,
          isCompleted: false,
          completionId: null,
          completedBy: null,
          canUndo: false,
        },
      }));
      return { snapshot };
    },
    onError: (_err, _vars, ctx) => restore(ctx?.snapshot),
    onSuccess: (outcome, _vars, ctx) => {
      if (outcome.kind === 'online') return;
      restore(ctx?.snapshot);
      if (outcome.kind === 'queued') {
        showNotice('Офлайн хадгаллаа. Холбогдмогц буцаалт синк хийгдэнэ.', 'warning');
      }
    },
    onSettled: (outcome) =>
      outcome?.kind === 'online' ? Promise.all([refreshHabits(), refreshProgress()]) : undefined,
  });
}
