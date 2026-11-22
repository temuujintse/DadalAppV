import * as Notifications from 'expo-notifications';
import type { Habit } from '@/types/api';
import { getPermission } from './push';
import { planReminders, ReminderOptions } from './reminder-plan';

let lastSignature = '';

/**
 * Replaces this app's scheduled local notifications with the current plan.
 * Skips the work when the plan has not changed since the last sync.
 */
export async function syncReminders(habits: readonly Habit[], opts: ReminderOptions): Promise<void> {
  try {
    if ((await getPermission()) !== 'granted') return;
    const plan = planReminders(habits, new Date(), opts);
    const signature = plan.map((p) => `${p.id}@${p.date.getTime()}|${p.body}`).join(';');
    if (signature === lastSignature) return;

    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const p of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: p.id,
        content: { title: p.title, body: p.body, data: p.data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: p.date },
      });
    }
    lastSignature = signature;
  } catch (err) {
    console.warn('[reminders] could not schedule', err);
  }
}

/** Sign-out: no reminders for a signed-out device. */
export async function clearReminders(): Promise<void> {
  lastSignature = '';
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nothing scheduled */
  }
}
