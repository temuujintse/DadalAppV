import { useMutation } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import type { Me } from '@/types/api';

export interface UpdateProfileBody {
  displayName?: string;
  avatarKey?: string;
  timezone?: string;
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: (body: UpdateProfileBody) => api.patch<Me>('/users/me', body),
    onSuccess: async (me) => {
      queryClient.setQueryData(queryKeys.me, me);
      // Member list shows names/avatars.
      await queryClient.invalidateQueries({ queryKey: queryKeys.members });
    },
  });
}

/** Everything that shows people (members, habits, leaderboard, rewards) gets the new photo. */
async function photoChanged(me: Me) {
  queryClient.setQueryData(queryKeys.me, me);
  await Promise.all(
    [queryKeys.family, queryKeys.habits, queryKeys.gamification, queryKeys.rewards, queryKeys.quests].map(
      (queryKey) => queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

/** Uploads a base64 JPEG already resized on the device (see pickProfilePhoto). */
export function useUploadPhoto() {
  return useMutation({
    mutationFn: (image: string) => api.put<Me>('/users/me/photo', { image }),
    onSuccess: photoChanged,
  });
}

export function useRemovePhoto() {
  return useMutation({
    mutationFn: () => api.delete<Me>('/users/me/photo'),
    onSuccess: photoChanged,
  });
}
