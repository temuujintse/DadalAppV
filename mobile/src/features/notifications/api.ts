import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import type { AppNotification } from '@/types/api';

export function useNotificationsInbox() {
  return useQuery({
    queryKey: queryKeys.notificationList,
    queryFn: () => api.get<AppNotification[]>('/notifications?limit=50'),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: queryKeys.notificationUnread,
    queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'),
    select: (d) => d.unread,
    refetchInterval: 60_000,
  });
}

export const refreshNotifications = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.notifications });

export function useMarkRead() {
  return useMutation({
    mutationFn: (id: string) => api.post<AppNotification>(`/notifications/${id}/read`),
    onMutate: (id) => {
      queryClient.setQueryData<AppNotification[]>(queryKeys.notificationList, (list) =>
        list?.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
      );
    },
    onSettled: refreshNotifications,
  });
}

export function useMarkAllRead() {
  return useMutation({
    mutationFn: () => api.post<{ unread: number }>('/notifications/read-all'),
    onSuccess: () => {
      const now = new Date().toISOString();
      queryClient.setQueryData<AppNotification[]>(queryKeys.notificationList, (list) =>
        list?.map((n) => (n.readAt ? n : { ...n, readAt: now })),
      );
      queryClient.setQueryData(queryKeys.notificationUnread, { unread: 0 });
    },
    onSettled: refreshNotifications,
  });
}
