import { useMutation, useQuery } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { refreshProgress } from '@/features/gamification/api';
import { api } from '@/services/api/client';
import { ApiError } from '@/services/api/errors';
import { isOnline } from '@/services/offline/connectivity';
import { useOutboxStore } from '@/services/offline/outbox';
import { queueOperation } from '@/services/offline/sync-engine';
import { queryClient, queryKeys } from '@/services/query-client';
import { celebrateCare } from '@/store/celebration.store';
import { showNotice } from '@/store/notice.store';
import type {
  Accessory,
  CareResult,
  Pet,
  PetCareType,
  PetHistoryItem,
  PetSpecies,
} from '@/types/api';
import { emitPetEvent } from './animation/pet-animation';

export function usePet() {
  return useQuery({
    queryKey: queryKeys.petMe,
    queryFn: () => api.get<Pet>('/pet/me'),
  });
}

export function useAccessories() {
  return useQuery({
    queryKey: queryKeys.petAccessories,
    queryFn: () => api.get<Accessory[]>('/pet/me/accessories'),
  });
}

export function usePetHistory() {
  return useQuery({
    queryKey: queryKeys.petHistory,
    queryFn: () => api.get<PetHistoryItem[]>('/pet/me/history?limit=20'),
  });
}

function refreshPet() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.pet }),
    queryClient.invalidateQueries({ queryKey: queryKeys.quests }),
  ]);
}

export function useUpdatePet() {
  return useMutation({
    mutationFn: (body: { name?: string; species?: PetSpecies }) => api.patch<Pet>('/pet/me', body),
    onSuccess: (pet) => {
      queryClient.setQueryData(queryKeys.petMe, pet);
      emitPetEvent('TAPPED');
    },
  });
}

const CARE_EVENT = {
  PET: 'CARE_PET',
  FEED: 'CARE_FEED',
  PLAY: 'CARE_PLAY',
  BATH: 'CARE_BATH',
} as const;

export const CARE_LABELS: Record<PetCareType, string> = {
  PET: 'Илбэх',
  FEED: 'Хооллох',
  PLAY: 'Тоглох',
  BATH: 'Угаах',
};

export type CareOutcome = { kind: 'online'; result: CareResult } | { kind: 'queued' };

/** Care types waiting in the offline queue (one per type; the server enforces cooldowns). */
export function useQueuedCareTypes(): PetCareType[] {
  const pending = useOutboxStore((s) => s.pending);
  return pending.flatMap((op) => (op.type === 'PET_CARE' ? [op.payload.type] : []));
}

/**
 * The pet reacts the moment you tap; the server decides XP, cooldown and unlocks.
 * Offline the action is queued and its Pet XP arrives when the server confirms it.
 */
export function useCare() {
  return useMutation({
    mutationFn: async (type: PetCareType): Promise<CareOutcome> => {
      const idempotencyKey = randomUUID();
      const queue = async () => {
        const waiting = useOutboxStore
          .getState()
          .pending.some((op) => op.type === 'PET_CARE' && op.payload.type === type);
        if (waiting) {
          throw new ApiError(0, 'CARE_QUEUED', 'Энэ арчилгаа синк хүлээж байна.');
        }
        await queueOperation({
          type: 'PET_CARE',
          payload: { type, idempotencyKey },
          label: CARE_LABELS[type],
        });
        return { kind: 'queued' } as const;
      };
      if (!isOnline()) return queue();
      try {
        return {
          kind: 'online',
          result: await api.post<CareResult>('/pet/me/care', { type, idempotencyKey }),
        };
      } catch (err) {
        if (err instanceof ApiError && err.isNetwork) return queue();
        throw err;
      }
    },
    onMutate: (type) => emitPetEvent(CARE_EVENT[type]),
    onSuccess: (outcome) => {
      if (outcome.kind === 'queued') {
        showNotice('Офлайн хадгаллаа. Pet XP синк хийгдсэний дараа нэмэгдэнэ.', 'warning');
        return;
      }
      queryClient.setQueryData(queryKeys.petMe, outcome.result.pet);
      celebrateCare(outcome.result);
    },
    onSettled: (outcome) =>
      outcome?.kind === 'queued' ? undefined : Promise.all([refreshPet(), refreshProgress()]),
  });
}

export function useToggleAccessory() {
  return useMutation({
    mutationFn: ({ id, equip }: { id: string; equip: boolean }) =>
      api.post<Pet>(`/pet/me/accessories/${id}/${equip ? 'equip' : 'unequip'}`),
    onSuccess: (pet, { equip }) => {
      queryClient.setQueryData(queryKeys.petMe, pet);
      if (equip) emitPetEvent('ACCESSORY_EQUIPPED');
    },
    onSettled: refreshPet,
  });
}
