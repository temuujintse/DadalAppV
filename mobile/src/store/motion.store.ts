import { create } from 'zustand';
import { getMeta, setMeta } from '@/services/offline/db';

/**
 * In-app "Reduce motion" option (spec 6.5). 'system' follows the iOS/Android accessibility
 * setting; 'reduce' always reduces, even when the system setting is off. Stored on the device.
 */
export type MotionPreference = 'system' | 'reduce';

const KEY = 'pref:motion';

export const useMotionStore = create<{ preference: MotionPreference }>(() => ({
  preference: 'system',
}));

export async function loadMotionPreference(): Promise<void> {
  try {
    if ((await getMeta(KEY)) === 'reduce') useMotionStore.setState({ preference: 'reduce' });
  } catch {
    /* keep the default */
  }
}

export async function setMotionPreference(preference: MotionPreference): Promise<void> {
  useMotionStore.setState({ preference });
  try {
    await setMeta(KEY, preference);
  } catch {
    /* applies for this session even if it cannot be saved */
  }
}
