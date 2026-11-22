import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api/errors';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Responses are also persisted to SQLite; keep them in memory for offline browsing.
      gcTime: 24 * 60 * 60 * 1000,
      // Retry only transient failures; 4xx answers are final.
      retry: (failureCount, error) =>
        failureCount < 2 &&
        (!(error instanceof ApiError) || error.isNetwork || error.status >= 500),
    },
    // Mutations run (and fail fast) even offline; the ones that support offline mode queue
    // themselves instead of pausing silently.
    mutations: { retry: false, networkMode: 'always' },
  },
});

export const queryKeys = {
  me: ['me'] as const,
  family: ['family', 'current'] as const,
  members: ['family', 'members'] as const,
  invites: ['family', 'invites'] as const,
  habits: ['habits'] as const,
  habitList: (scope: string) => ['habits', 'list', scope] as const,
  habit: (id: string) => ['habits', 'detail', id] as const,
  habitCalendar: (id: string, month: string) => ['habits', 'calendar', id, month] as const,
  gamification: ['gamification'] as const,
  myGamification: ['gamification', 'me'] as const,
  familyGamification: ['gamification', 'family'] as const,
  xpHistory: ['gamification', 'transactions'] as const,
  leaderboard: (period: string) => ['gamification', 'leaderboard', period] as const,
  achievements: ['gamification', 'achievements'] as const,
  pet: ['pet'] as const,
  petMe: ['pet', 'me'] as const,
  petAccessories: ['pet', 'accessories'] as const,
  petHistory: ['pet', 'history'] as const,
  quests: ['quests'] as const,
  rewards: ['rewards'] as const,
  rewardList: ['rewards', 'list'] as const,
  redemptions: (scope: string) => ['rewards', 'redemptions', scope] as const,
  syncStatus: ['sync', 'status'] as const,
  notifications: ['notifications'] as const,
  notificationList: ['notifications', 'list'] as const,
  notificationUnread: ['notifications', 'unread'] as const,
};
