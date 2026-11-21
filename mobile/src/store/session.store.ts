import { create } from 'zustand';
import { decodeJwtSub } from '@/services/offline/logic';
import { forgetOfflineUser, prepareOfflineUser } from '@/services/offline/lifecycle';
import { queryClient } from '@/services/query-client';
import { clearTokens, loadTokens, saveTokens } from '@/services/storage/token-storage';
import type { TokenPair } from '@/types/api';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

interface SessionState {
  status: SessionStatus;
  tokens: TokenPair | null;
  /** Owner of the local offline data (from the token's `sub`). */
  userId: string | null;
  /** Reads tokens from SecureStore once at app start and restores that user's offline data. */
  bootstrap: () => Promise<void>;
  setTokens: (tokens: TokenPair) => Promise<void>;
  /**
   * Local sign-out: forget tokens, every cached server response and the on-device cache.
   * Actions still waiting to sync stay on the device and are sent at that user's next sign-in.
   */
  signOut: () => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  status: 'loading',
  tokens: null,
  userId: null,

  bootstrap: async () => {
    const tokens = await loadTokens();
    const userId = decodeJwtSub(tokens?.accessToken);
    if (tokens && userId) await prepareOfflineUser(userId);
    set({ tokens, userId, status: tokens ? 'signedIn' : 'signedOut' });
  },

  setTokens: async (tokens) => {
    await saveTokens(tokens);
    const userId = decodeJwtSub(tokens.accessToken);
    // Token refresh keeps the same user; only a new sign-in loads offline data.
    if (userId && userId !== get().userId) await prepareOfflineUser(userId);
    set({ tokens, userId, status: 'signedIn' });
  },

  signOut: async () => {
    const { userId } = get();
    await clearTokens();
    queryClient.clear();
    if (userId) await forgetOfflineUser(userId);
    set({ tokens: null, userId: null, status: 'signedOut' });
  },
}));
