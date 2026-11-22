import { create } from 'zustand';
import { getMeta, setMeta } from '@/services/offline/db';

/** Device-level notification preferences (Profile → Мэдэгдэл). */
export interface NotificationPrefs {
  /** Local reminders at each habit's reminder time. */
  habitReminders: boolean;
  /** 20:00 "habits left today" nudge. */
  eveningNudge: boolean;
  /** Family / reward push notifications from the server. */
  push: boolean;
}

const KEY = 'pref:notifications';
const DEFAULTS: NotificationPrefs = { habitReminders: true, eveningNudge: true, push: true };

export const useNotificationPrefs = create<NotificationPrefs & { loaded: boolean }>(() => ({
  ...DEFAULTS,
  loaded: false,
}));

export async function loadNotificationPrefs(): Promise<void> {
  try {
    const raw = await getMeta(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<NotificationPrefs>) : {};
    useNotificationPrefs.setState({ ...DEFAULTS, ...saved, loaded: true });
  } catch {
    useNotificationPrefs.setState({ loaded: true });
  }
}

export async function setNotificationPref<K extends keyof NotificationPrefs>(
  key: K,
  value: NotificationPrefs[K],
): Promise<void> {
  useNotificationPrefs.setState({ [key]: value } as Partial<NotificationPrefs>);
  const { habitReminders, eveningNudge, push } = useNotificationPrefs.getState();
  try {
    await setMeta(KEY, JSON.stringify({ habitReminders, eveningNudge, push }));
  } catch {
    /* applies for this session */
  }
}
