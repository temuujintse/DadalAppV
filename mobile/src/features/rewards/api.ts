import { useMutation, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { refreshProgress } from '@/features/gamification/api';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import type { Redemption, RedemptionDecisionResult, Reward } from '@/types/api';

export interface RewardInput {
  title: string;
  description?: string | null;
  icon: string;
  xpCost: number;
  isActive?: boolean;
}

export function useRewards() {
  return useQuery({
    queryKey: queryKeys.rewardList,
    queryFn: () => api.get<Reward[]>('/rewards'),
  });
}

/** "mine" for everyone; "family" (all requests) for OWNER/PARENT. */
export function useRedemptions(scope: 'mine' | 'family', enabled = true) {
  return useQuery({
    queryKey: queryKeys.redemptions(scope),
    queryFn: () => api.get<Redemption[]>(`/redemptions?scope=${scope}`),
    enabled,
  });
}

function refreshRewards() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.rewards }),
    refreshProgress(),
  ]);
}

export function useSaveReward() {
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: RewardInput }) =>
      id ? api.patch<Reward[]>(`/rewards/${id}`, body) : api.post<Reward[]>('/rewards', body),
    onSuccess: (list) => queryClient.setQueryData(queryKeys.rewardList, list),
    onSettled: refreshRewards,
  });
}

export function useDeleteReward() {
  return useMutation({
    mutationFn: (id: string) => api.delete<null>(`/rewards/${id}`),
    onSettled: refreshRewards,
  });
}

export function useRedeem() {
  return useMutation({
    mutationFn: ({ rewardId, note }: { rewardId: string; note?: string }) =>
      api.post<Redemption>(`/rewards/${rewardId}/redeem`, {
        idempotencyKey: randomUUID(),
        note: note || undefined,
      }),
    onSettled: refreshRewards,
  });
}

export type RedemptionAction = 'approve' | 'reject' | 'complete' | 'cancel';

export function useRedemptionAction() {
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: RedemptionAction; note?: string }) =>
      api.post<RedemptionDecisionResult>(
        `/redemptions/${id}/${action}`,
        action === 'approve' || action === 'reject' ? { note: note || undefined } : undefined,
      ),
    onSettled: refreshRewards,
  });
}
