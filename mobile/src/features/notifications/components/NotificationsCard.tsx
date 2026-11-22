import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, Switch, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { colors, spacing } from '@/theme';
import { NotificationPrefs, setNotificationPref, useNotificationPrefs } from '../prefs.store';
import { getPermission, PermissionState, requestPermission } from '../push';

const ROWS: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
  {
    key: 'habitReminders',
    label: 'Дадлын сануулга',
    hint: 'Дадал бүрт тохируулсан цагт. Биелүүлсэн өдөр сануулахгүй.',
  },
  { key: 'eveningNudge', label: 'Оройн сануулга', hint: '20:00-д дуусаагүй дадал үлдсэн бол.' },
  {
    key: 'push',
    label: 'Гэр бүлийн мэдэгдэл',
    hint: 'Шинэ гишүүн, хамтын дадал, шагналын хүсэлт ба хариу.',
  },
];

/** Profile section: notification permission + what to be notified about. */
export function NotificationsCard() {
  const prefs = useNotificationPrefs();
  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    const check = () => void getPermission().then(setPermission);
    check();
    // Returning from the system Settings app may have changed it.
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  const toggle = async (key: keyof NotificationPrefs, on: boolean) => {
    if (on && permission !== 'granted') setPermission(await requestPermission());
    await setNotificationPref(key, on);
  };

  return (
    <Card>
      <AppText variant="label">Мэдэгдэл</AppText>
      {permission === 'denied' ? (
        <View style={styles.denied}>
          <AppText variant="caption" color={colors.warningText}>
            Мэдэгдлийг утасны тохиргоонд хаасан байна. Сануулга авахын тулд зөвшөөрнө үү.
          </AppText>
          <Button title="Тохиргоо нээх" variant="secondary" onPress={() => void Linking.openSettings()} />
        </View>
      ) : null}
      {ROWS.map((r) => (
        <View key={r.key} style={styles.row}>
          <View style={styles.text}>
            <AppText variant="bodyStrong">{r.label}</AppText>
            <AppText variant="caption" color={colors.secondary}>
              {r.hint}
            </AppText>
          </View>
          <Switch
            value={prefs[r.key] && permission !== 'denied'}
            disabled={permission === 'denied'}
            onValueChange={(on) => void toggle(r.key, on)}
            trackColor={{ true: colors.primary, false: colors.border }}
            accessibilityLabel={r.label}
          />
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
  denied: { gap: spacing.xs },
});
