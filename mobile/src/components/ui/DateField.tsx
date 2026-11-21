import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { CalendarDays, X } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

/** "YYYY-MM-DD" ⇄ local Date at noon (noon avoids DST edge cases). */
function toDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function toValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function formatValue(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return `${y}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
}

/** Date input: native compact picker on iOS, dialog on Android. Optional fields can be cleared. */
export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  placeholder = 'Сонгоогүй',
  clearable = false,
  error,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  minimumDate?: string;
  placeholder?: string;
  clearable?: boolean;
  error?: string;
}) {
  const min = minimumDate ? toDate(minimumDate) : undefined;
  const current = value ? toDate(value) : (min ?? new Date());

  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: current,
      mode: 'date',
      minimumDate: min,
      onValueChange: (_e, date) => onChange(toValue(date)),
    });

  return (
    <View style={styles.container}>
      <AppText variant="label">{label}</AppText>
      <View style={[styles.field, error ? { borderColor: colors.error } : null]}>
        <CalendarDays size={18} color={colors.secondary} />
        {Platform.OS === 'ios' && value ? (
          <DateTimePicker
            value={current}
            mode="date"
            display="compact"
            locale="mn-MN"
            minimumDate={min}
            accentColor={colors.primary}
            onValueChange={(_e, date) => onChange(toValue(date))}
            style={styles.iosPicker}
          />
        ) : (
          <Pressable
            style={styles.flex}
            onPress={() => (Platform.OS === 'android' ? openAndroid() : onChange(toValue(current)))}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value ? formatValue(value) : placeholder}`}
          >
            <AppText color={value ? colors.text : colors.secondary}>
              {value ? formatValue(value) : placeholder}
            </AppText>
          </Pressable>
        )}
        {clearable && value ? (
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
      {error ? (
        <AppText variant="caption" color={colors.errorText}>
          {error}
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
