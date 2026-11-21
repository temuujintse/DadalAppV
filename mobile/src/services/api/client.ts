import { reportServerReachable, reportServerUnreachable } from '@/services/offline/connectivity';
import { useSessionStore } from '@/store/session.store';
import type { ErrorEnvelope, SuccessEnvelope, TokenPair } from '@/types/api';
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { ApiError } from './errors';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  /** Attach the access token and transparently refresh it on expiry (default true). */
  auth?: boolean;
}

/** Codes that mean "the access token is stale, a refresh may help". */
const REFRESHABLE = new Set(['TOKEN_INVALID', 'UNAUTHORIZED']);

let refreshInFlight: Promise<TokenPair | null> | null = null;

/**
 * Single-flight refresh: concurrent 401s share one rotation request.
 * (The backend revokes the whole session if an old refresh token is replayed.)
 */
function refreshTokens(): Promise<TokenPair | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const { tokens, setTokens, signOut } = useSessionStore.getState();
      if (!tokens?.refreshToken) return null;
      try {
        const next = await send<TokenPair>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken: tokens.refreshToken },
          auth: false,
        });
        await setTokens(next);
        return next;
      } catch (err) {
        // Only a definitive rejection signs the user out; offline keeps the session.
        if (err instanceof ApiError && !err.isNetwork) await signOut();
        if (err instanceof ApiError && err.isNetwork) throw err;
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function rawFetch(path: string, options: RequestOptions, accessToken?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    reportServerReachable();
    return res;
  } catch (err) {
    // No HTTP answer at all: the app switches to offline mode until the server is back.
    reportServerUnreachable();
    if (err instanceof Error && err.name === 'AbortError') throw ApiError.client('TIMEOUT');
    throw ApiError.client('NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(res: Response): Promise<T> {
  let json: SuccessEnvelope<T> | ErrorEnvelope;
  try {
    json = (await res.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  } catch {
    throw new ApiError(res.status, 'INVALID_RESPONSE', 'Серверээс ойлгомжгүй хариу ирлээ.');
  }
  if (json && json.success === true) return json.data;
  if (json && json.success === false && json.error) throw ApiError.fromEnvelope(res.status, json);
  throw new ApiError(res.status, 'INVALID_RESPONSE', 'Серверээс ойлгомжгүй хариу ирлээ.');
}

async function send<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const useAuth = options.auth ?? true;
  const token = useAuth ? useSessionStore.getState().tokens?.accessToken : undefined;
  let res = await rawFetch(path, options, token);

  if (res.status === 401 && useAuth) {
    const body = (await res
      .clone()
      .json()
      .catch(() => null)) as ErrorEnvelope | null;
    const code = body?.error?.code;
    if (code && REFRESHABLE.has(code)) {
      const next = await refreshTokens();
      if (!next) throw ApiError.client('SESSION_EXPIRED');
      res = await rawFetch(path, options, next.accessToken);
    } else if (code === 'SESSION_REVOKED') {
      await useSessionStore.getState().signOut();
    }
  }
  return parse<T>(res);
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    send<T>(path, { ...opts, method: 'DELETE' }),
};
