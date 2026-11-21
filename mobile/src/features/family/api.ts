import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import type { CreatedInvite, Family, FamilyMember, FamilyRole, Invite } from '@/types/api';

/** Membership changes affect /auth/me (family block) and every family query. */
async function refreshFamilyState(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.me }),
    queryClient.invalidateQueries({ queryKey: ['family'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.gamification }),
  ]);
}

export function useFamily(enabled = true) {
  return useQuery({
    queryKey: queryKeys.family,
    queryFn: () => api.get<Family>('/families/current'),
    enabled,
  });
}

export function useMembers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: () => api.get<FamilyMember[]>('/families/current/members'),
    enabled,
  });
}

export function useInvites(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invites,
    queryFn: () => api.get<Invite[]>('/families/current/invites'),
    enabled,
  });
}

export function useCreateFamily() {
  return useMutation({
    mutationFn: (body: { name: string; avatarKey: string }) => api.post<Family>('/families', body),
    onSuccess: async (family) => {
      queryClient.setQueryData(queryKeys.family, family);
      await refreshFamilyState();
    },
  });
}

export function useJoinFamily() {
  return useMutation({
    mutationFn: (code: string) => api.post<Family>('/families/join', { code }),
    onSuccess: async (family) => {
      queryClient.setQueryData(queryKeys.family, family);
      await refreshFamilyState();
    },
  });
}

export function useUpdateFamily() {
  return useMutation({
    mutationFn: (body: { name?: string; avatarKey?: string; leaderboardEnabled?: boolean }) =>
      api.patch<Family>('/families/current', body),
    onSuccess: refreshFamilyState,
  });
}

export function useCreateInvite() {
  return useMutation({
    mutationFn: (body: { role: Exclude<FamilyRole, 'OWNER'>; maxUses: number }) =>
      api.post<CreatedInvite>('/families/current/invites', body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites }),
  });
}

export function useRevokeInvite() {
  return useMutation({
    mutationFn: (inviteId: string) => api.delete<null>(`/families/current/invites/${inviteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites }),
  });
}

export function useChangeRole() {
  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: Exclude<FamilyRole, 'OWNER'> }) =>
      api.patch<FamilyMember[]>(`/families/current/members/${memberId}`, { role }),
    onSuccess: (members) => queryClient.setQueryData(queryKeys.members, members),
  });
}

export function useTransferOwnership() {
  return useMutation({
    mutationFn: (memberId: string) =>
      api.post<FamilyMember[]>('/families/current/transfer-ownership', { memberId }),
    onSuccess: refreshFamilyState,
  });
}

/** Removes another member, or leaves the family when `memberId` is the caller's own. */
export function useRemoveMember() {
  return useMutation({
    mutationFn: (memberId: string) =>
      api.delete<{ familyDissolved: boolean }>(`/families/current/members/${memberId}`),
    onSuccess: refreshFamilyState,
  });
}
