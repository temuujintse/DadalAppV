import { useMutation, useQuery } from '@tanstack/react-query';
import { refreshProgress } from '@/features/gamification/api';
import { emitPetEvent } from '@/features/pets/animation/pet-animation';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import { celebrateClaim } from '@/store/celebration.store';
import type { ClaimResult, Quest } from '@/types/api';

export function useQuests() {
  return useQuery({
    queryKey: queryKeys.quests,
    queryFn: () => api.get<Quest[]>('/quests'),
  });
}

export function useClaimQuest() {
  return useMutation({
    mutationFn: (questId: string) => api.post<ClaimResult>(`/quests/${questId}/claim`),
    onSuccess: (result) => {
      queryClient.setQueryData<Quest[]>(queryKeys.quests, (list) =>
        list?.map((q) => (q.id === result.quest.id ? result.quest : q)),
      );
      emitPetEvent('QUEST_COMPLETED');
      celebrateClaim(result);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.quests }),
        refreshProgress(),
      ]),
  });
}
