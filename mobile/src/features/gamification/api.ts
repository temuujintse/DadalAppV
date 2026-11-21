import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import type {
  Achievement,
  FamilyGamification,
  Leaderboard,
  LeaderboardPeriod,
  MyGamification,
  XpTransaction,
} from '@/types/api';

export function useMyGamification() {
  return useQuery({
    queryKey: queryKeys.myGamification,
    queryFn: () => api.get<MyGamification>('/gamification/me'),
  });
}

export function useFamilyGamification(enabled = true) {
  return useQuery({
    queryKey: queryKeys.familyGamification,
    queryFn: () => api.get<FamilyGamification>('/gamification/family'),
    enabled,
  });
}

export function useXpHistory() {
  return useQuery({
    queryKey: queryKeys.xpHistory,
    queryFn: () => api.get<XpTransaction[]>('/gamification/me/transactions?limit=30'),
  });
}

export function useLeaderboard(period: LeaderboardPeriod) {
  return useQuery({
    queryKey: queryKeys.leaderboard(period),
    queryFn: () => api.get<Leaderboard>(`/gamification/leaderboard?period=${period}`),
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.achievements,
    queryFn: () => api.get<Achievement[]>('/gamification/achievements'),
  });
}

/** XP, level, family and leaderboard numbers all change after a completion or undo. */
export function refreshProgress() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.gamification }),
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    queryClient.invalidateQueries({ queryKey: queryKeys.family }),
  ]);
}
