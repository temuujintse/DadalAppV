import Constants from 'expo-constants';

const API_PATH = '/api/v1';
const API_PORT = 3000;

/**
 * Resolves the API base URL.
 * 1. EXPO_PUBLIC_API_URL when set (staging / production builds).
 * 2. In development: the host Metro is served from (works for simulators and phones on the
 *    same Wi-Fi), on port 3000.
 */
export function resolveApiBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  if (!__DEV__) {
    // app.config.ts blocks such store builds; this only catches hand-made release builds.
    console.error('[config] EXPO_PUBLIC_API_URL is not set in a release build');
  }

  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:${API_PORT}${API_PATH}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const REQUEST_TIMEOUT_MS = 15_000;
