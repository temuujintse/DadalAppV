import { useMutation, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import type {
  AIAnalytics,
  AIDayPlans,
  AIPlan,
  PetInteraction,
  AIChatResult,
  AIConversation,
  AIConversationSummary,
  AIRecommendation,
  AIStatus,
  HabitDetail,
} from '@/types/api';

export function useAIStatus() {
  return useQuery({ queryKey: queryKeys.aiStatus, queryFn: () => api.get<AIStatus>('/ai/status') });
}

export function usePendingRecommendations() {
  return useQuery({
    queryKey: queryKeys.aiRecommendations,
    queryFn: () => api.get<AIRecommendation[]>('/ai/coach/recommendations?status=PENDING'),
  });
}

const refreshAI = () => queryClient.invalidateQueries({ queryKey: queryKeys.ai });

/** One idempotency key per submitted goal: a retry after a timeout returns the same set. */
export function useRecommend() {
  return useMutation({
    mutationFn: ({ goal, idempotencyKey }: { goal: string; idempotencyKey: string }) =>
      api.post<AIRecommendation[]>('/ai/coach/recommendations', { goal, idempotencyKey }),
    onSettled: refreshAI,
  });
}

export const newRequestKey = (): string => randomUUID();

export function useAcceptRecommendation() {
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; reminderTime?: string }) =>
      api.post<{ recommendation: AIRecommendation; habit: HabitDetail }>(
        `/ai/coach/recommendations/${id}/accept`,
        body,
      ),
    onSettled: () =>
      Promise.all([refreshAI(), queryClient.invalidateQueries({ queryKey: queryKeys.habits })]),
  });
}

export function useRejectRecommendation() {
  return useMutation({
    mutationFn: (id: string) => api.post<AIRecommendation>(`/ai/coach/recommendations/${id}/reject`, {}),
    onMutate: (id) => {
      queryClient.setQueryData<AIRecommendation[]>(queryKeys.aiRecommendations, (list) =>
        list?.filter((r) => r.id !== id),
      );
    },
    onSettled: refreshAI,
  });
}

export function useConversations() {
  return useQuery({
    queryKey: queryKeys.aiConversations,
    queryFn: () => api.get<AIConversationSummary[]>('/ai/conversations'),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: queryKeys.aiConversation(id ?? 'none'),
    queryFn: () => api.get<AIConversation>(`/ai/conversations/${id}`),
    enabled: Boolean(id),
  });
}

export function useSendChat() {
  return useMutation({
    mutationFn: (body: { conversationId?: string; message: string; clientKey: string }) =>
      api.post<AIChatResult>('/ai/coach/chat', body),
    onSuccess: (result) => {
      queryClient.setQueryData<AIConversation>(queryKeys.aiConversation(result.conversationId), (c) =>
        c ? { ...c, messages: [...c.messages, result.userMessage, result.assistantMessage] } : c,
      );
    },
    onSettled: refreshAI,
  });
}

export function useDeleteConversation() {
  return useMutation({
    mutationFn: (id: string) => api.delete<null>(`/ai/conversations/${id}`),
    onSettled: refreshAI,
  });
}

// ───────────── Smart Planner ─────────────

export function useDayPlans() {
  return useQuery({ queryKey: queryKeys.aiPlans, queryFn: () => api.get<AIDayPlans>('/ai/planner') });
}

export function useGeneratePlan() {
  return useMutation({
    mutationFn: (body: { idempotencyKey: string; availableFrom?: string; availableTo?: string }) =>
      api.post<AIPlan>('/ai/planner/generate', body),
    onSettled: refreshAI,
  });
}

export function useConfirmPlan() {
  return useMutation({
    mutationFn: (id: string) => api.post<AIPlan>(`/ai/planner/${id}/confirm`),
    onSettled: refreshAI,
  });
}

export function useRegeneratePlan() {
  return useMutation({
    mutationFn: ({ id, idempotencyKey }: { id: string; idempotencyKey: string }) =>
      api.post<AIPlan>(`/ai/planner/${id}/regenerate`, { idempotencyKey }),
    onSettled: refreshAI,
  });
}

// ───────────── Pet companion & analytics ─────────────

/** Pet speech bubble: templates offline-first on the server; works even when AI is off. */
export function usePetInteraction() {
  return useQuery({
    queryKey: queryKeys.aiPet,
    queryFn: () => api.post<PetInteraction>('/ai/pet/interact', {}),
    staleTime: 10 * 60_000,
  });
}

export function useAnalytics(period: 'weekly' | 'monthly') {
  return useQuery({
    queryKey: queryKeys.aiAnalytics(period),
    queryFn: () => api.get<AIAnalytics>(`/ai/analytics/${period}`),
    staleTime: 60 * 60_000,
  });
}
