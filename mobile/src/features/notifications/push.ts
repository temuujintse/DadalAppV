import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { api } from '@/services/api/client';
import { getMeta, setMeta } from '@/services/offline/db';

const TOKEN_KEY = 'push:token';
const ASKED_KEY = 'push:asked';

/** Foreground presentation: show the banner, no sound. Call once at startup. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

/** Asks the system once (iOS shows its dialog only the first time). */
export async function requestPermission(): Promise<PermissionState> {
  const current = await getPermission();
  if (current !== 'undetermined') return current;
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

/** First signed-in launch: ask once, never nag. */
export async function askPermissionOnce(): Promise<PermissionState> {
  try {
    if (await getMeta(ASKED_KEY)) return await getPermission();
    await setMeta(ASKED_KEY, '1');
    return await requestPermission();
  } catch {
    return 'undetermined';
  }
}

/**
 * Registers this device's Expo push token with the API. Fails quietly where push is not
 * available (simulator, Expo Go on Android, no network) — local reminders still work.
 */
export async function registerForPush(): Promise<boolean> {
  try {
    if ((await getPermission()) !== 'granted') return false;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)
      ?.eas?.projectId;
    if (!projectId) return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.put<null>('/notifications/push-token', {
      token,
      platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
    });
    await setMeta(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

/** Sign-out / opt-out: stop server pushes to this device. Best effort. */
export async function removePushRegistration(): Promise<void> {
  try {
    const token = await getMeta(TOKEN_KEY);
    if (!token) return;
    await api.delete<null>('/notifications/push-token', { body: { token } });
    await setMeta(TOKEN_KEY, '');
  } catch {
    /* offline or already signed out */
  }
}
