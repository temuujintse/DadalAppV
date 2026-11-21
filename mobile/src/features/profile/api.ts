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
