import { useMutation, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import type {
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
