import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { useHabits } from '@/features/habits/api';
import { refreshNotifications } from './api';
import { useNotificationPrefs } from './prefs.store';
import { askPermissionOnce, registerForPush, removePushRegistration } from './push';
import { syncReminders } from './reminders';

function openRoute(data: unknown): void {
  const route = (data as { route?: unknown } | null)?.route;
  if (typeof route === 'string' && route.startsWith('/')) {
    router.push(route as Parameters<typeof router.push>[0]);
  }
}

/**
 * Signed-in app wiring (mounted in the tabs layout):
 * - asks for permission once, registers / removes the push token per preference
 * - keeps local reminders in sync with today's habits
 * - opens the screen a tapped notification points to; refreshes the inbox on arrival
 */
export function useNotificationsRuntime(): void {
  const prefs = useNotificationPrefs();
  const habits = useHabits('all');

  useEffect(() => {
    if (!prefs.loaded) return;
    void (async () => {
      const permission = await askPermissionOnce();
      if (permission !== 'granted') return;
      if (prefs.push) await registerForPush();
      else await removePushRegistration();
    })();
  }, [prefs.loaded, prefs.push]);

  useEffect(() => {
    if (!prefs.loaded || !habits.data) return;
    void syncReminders(habits.data, {
      habitReminders: prefs.habitReminders,
      eveningNudge: prefs.eveningNudge,
    });
  }, [prefs.loaded, prefs.habitReminders, prefs.eveningNudge, habits.data]);

  useEffect(() => {
    const tapped = Notifications.addNotificationResponseReceivedListener((r) =>
      openRoute(r.notification.request.content.data),
    );
    const received = Notifications.addNotificationReceivedListener(() => {
      void refreshNotifications();
    });
    // Cold start from a notification tap.
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      openRoute(last.notification.request.content.data);
      Notifications.clearLastNotificationResponse();
    }
    return () => {
      tapped.remove();
      received.remove();
    };
  }, []);
}
