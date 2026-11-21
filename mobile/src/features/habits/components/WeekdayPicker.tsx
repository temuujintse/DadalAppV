import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing } from '@/theme';
import { SCHEDULE_PRESETS, WEEKDAYS } from '../constants';

export function WeekdayPicker({
  value,
  onChange,
  error,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  error?: string;
}) {
  const selected = new Set(value);
  const toggle = (day: number) => {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    onChange([...next].sort((a, b) => a - b));
  };

  return (
    <View style={styles.container}>
      <View style={styles.presets}>
        {SCHEDULE_PRESETS.map((p) => {
          const active = p.days.length === selected.size && p.days.every((d) => selected.has(d));
          return (
            <PressableScale
              key={p.label}
              onPress={() => onChange([...p.days])}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.preset, active && styles.presetActive]}
            >
              <AppText variant="caption" color={active ? colors.primaryText : colors.secondary}>
                {p.label}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
      <View style={styles.days}>
        {WEEKDAYS.map((w) => {
          const on = selected.has(w.value);
          return (
            <PressableScale
              key={w.value}
              onPress={() => toggle(w.value)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={w.long}
              style={[styles.day, on && styles.dayOn]}
            >
              <AppText variant="label" color={on ? colors.white : colors.text}>
                {w.short}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.errorText}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  presets: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  preset: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  presetActive: { backgroundColor: colors.primarySoft },
  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dayOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
