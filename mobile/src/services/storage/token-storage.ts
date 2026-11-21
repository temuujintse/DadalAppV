import * as SecureStore from 'expo-secure-store';
import type { TokenPair } from '@/types/api';

/**
 * Tokens live only in the OS keychain/keystore (never SQLite/AsyncStorage).
 * The value is a single JSON blob so access + refresh tokens can never get out of sync.
 */
const KEY = 'familyhabit.session.v1';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function loadTokens(): Promise<TokenPair | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY, OPTIONS);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TokenPair>;
    if (!parsed.accessToken || !parsed.refreshToken) return null;
    return parsed as TokenPair;
  } catch {
    return null;
  }
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), OPTIONS);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY, OPTIONS);
}
