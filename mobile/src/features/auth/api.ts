import { useMutation, useQuery } from '@tanstack/react-query';
import { api } from '@/services/api/client';
import { queryClient, queryKeys } from '@/services/query-client';
import { useSessionStore } from '@/store/session.store';
import type { AuthResult, Me } from '@/types/api';
import { deviceTimeZone } from '@/utils/device';
import type { LoginForm, RegisterForm } from './schemas';

async function startSession(result: AuthResult): Promise<void> {
  queryClient.setQueryData(queryKeys.me, result.user);
  await useSessionStore.getState().setTokens(result.tokens);
}

export function useLogin() {
  return useMutation({
    mutationFn: (form: LoginForm) => api.post<AuthResult>('/auth/login', form, { auth: false }),
    onSuccess: startSession,
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (form: RegisterForm) =>
      api.post<AuthResult>(
        '/auth/register',
        { ...form, timezone: deviceTimeZone() },
        { auth: false },
      ),
    onSuccess: startSession,
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      // Best effort: revoke the server session, but always sign out locally.
      try {
        await api.post<null>('/auth/logout');
      } catch {
        /* offline or already revoked — local sign-out below is what matters */
      }
    },
    onSettled: () => useSessionStore.getState().signOut(),
  });
}

export function useMe() {
  const signedIn = useSessionStore((s) => s.status === 'signedIn');
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<Me>('/auth/me'),
    enabled: signedIn,
  });
}
