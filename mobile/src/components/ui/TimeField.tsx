import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { BellRing, X } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

/** "HH:mm" ⇄ today's Date at that time. */
function toDate(value: string): Date {
  const [h, m] = value.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function toValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Optional time-of-day input (habit reminder). Native compact picker on iOS, dialog on Android. */
export function TimeField({
  label,
  value,
  onChange,
  placeholder = 'Сануулахгүй',
  defaultTime = '19:00',
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  defaultTime?: string;
  hint?: string;
}) {
  const current = toDate(value ?? defaultTime);
  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: current,
      mode: 'time',
      is24Hour: true,
      onValueChange: (_e, date) => onChange(toValue(date)),
    });

  return (
    <View style={styles.container}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.field}>
        <BellRing size={18} color={value ? colors.primary : colors.secondary} />
        {Platform.OS === 'ios' && value ? (
          <DateTimePicker
            value={current}
            mode="time"
            display="compact"
            locale="mn-MN"
            accentColor={colors.primary}
            onValueChange={(_e, date) => onChange(toValue(date))}
            style={styles.iosPicker}
          />
        ) : (
          <Pressable
            style={styles.flex}
            onPress={() => (Platform.OS === 'android' ? openAndroid() : onChange(defaultTime))}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value ?? placeholder}`}
          >
            <AppText color={value ? colors.text : colors.secondary}>{value ?? placeholder}</AppText>
          </Pressable>
        )}
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${label} арилгах`}
          >
            <X size={18} color={colors.secondary} />
          </Pressable>
        ) : null}
      </View>
      {hint ? (
        <AppText variant="caption" color={colors.secondary}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  flex: { flex: 1, paddingVertical: spacing.sm },
  iosPicker: { flex: 1, alignItems: 'flex-start' },
});
