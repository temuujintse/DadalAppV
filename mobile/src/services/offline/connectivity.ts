import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { API_BASE_URL } from '@/services/api/config';

/**
 * "Online" means the device has a network AND our server answers. A phone on Wi-Fi with
 * the API down (or a captive portal) is offline for this app, so both signals are tracked:
 *   deviceOnline    — NetInfo
 *   serverReachable — any HTTP answer from the API; a failed request flips it off and a
 *                     /health probe with backoff flips it back on.
 * TanStack Query follows the combined value: queries pause (keeping cached data) instead of
 * failing while offline, and resume on reconnect.
 */
interface ConnectivityState {
  deviceOnline: boolean;
  serverReachable: boolean;
}

export const useConnectivity = create<ConnectivityState>(() => ({
  deviceOnline: true,
  serverReachable: true,
}));

const combined = (s: ConnectivityState) => s.deviceOnline && s.serverReachable;

export const isOnline = (): boolean => combined(useConnectivity.getState());
export const useIsOnline = (): boolean => useConnectivity(combined);

const PROBE_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
const PROBE_TIMEOUT_MS = 4_000;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeAttempt = 0;

function clearProbe() {
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = null;
  probeAttempt = 0;
}

function scheduleProbe() {
  if (probeTimer) return;
  const delay = PROBE_DELAYS_MS[Math.min(probeAttempt, PROBE_DELAYS_MS.length - 1)];
  probeTimer = setTimeout(() => {
    probeTimer = null;
    probeAttempt += 1;
    void probeServer();
  }, delay);
}

/** Any HTTP response proves the server is up. */
export function reportServerReachable(): void {
  const s = useConnectivity.getState();
  if (!s.serverReachable || !s.deviceOnline) {
    useConnectivity.setState({ serverReachable: true, deviceOnline: true });
  }
  clearProbe();
}

/** A request failed before any HTTP answer (no route, timeout, server down). */
export function reportServerUnreachable(): void {
  if (useConnectivity.getState().serverReachable) {
    useConnectivity.setState({ serverReachable: false });
  }
  scheduleProbe();
}

/** Pings /health once. Returns true when the server answered. */
export async function probeServer(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(`${API_BASE_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    reportServerReachable();
    return true;
  } catch {
    reportServerUnreachable();
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** Wires NetInfo, app foregrounding and TanStack Query's onlineManager. Call once. */
export function startConnectivity(): () => void {
  onlineManager.setEventListener((setOnline) => {
    setOnline(isOnline());
    return useConnectivity.subscribe((s) => setOnline(combined(s)));
  });

  const stopNetInfo = NetInfo.addEventListener((state) => {
    // null = unknown (e.g. at startup) → assume online and let requests decide.
    const deviceOnline = state.isConnected !== false;
    const was = useConnectivity.getState().deviceOnline;
    if (deviceOnline === was) return;
    useConnectivity.setState({ deviceOnline });
    if (deviceOnline) {
      clearProbe();
      void probeServer();
    }
  });

  const appState = AppState.addEventListener('change', (status) => {
    if (status === 'active' && !isOnline()) {
      clearProbe();
      void probeServer();
    }
  });

  return () => {
    stopNetInfo();
    appState.remove();
    clearProbe();
  };
}
