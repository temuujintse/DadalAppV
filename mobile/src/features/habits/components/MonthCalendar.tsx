import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { colors, spacing } from '@/theme';
import type { HabitCalendar } from '@/types/api';
import { WEEKDAYS } from '../constants';

const MONTHS = [
  '1-р сар',
  '2-р сар',
  '3-р сар',
  '4-р сар',
  '5-р сар',
  '6-р сар',
  '7-р сар',
  '8-р сар',
  '9-р сар',
  '10-р сар',
  '11-р сар',
  '12-р сар',
];

export function monthTitle(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y} оны ${MONTHS[m - 1]}`;
}

/** Monday-first month grid. Done = filled habit colour, missed = soft dot, today = ring. */
export function MonthCalendar({ calendar, color }: { calendar: HabitCalendar; color: string }) {
  const first = new Date(`${calendar.days[0].date}T00:00:00Z`).getUTCDay(); // 0 = Sun
  const leading = (first + 6) % 7; // Monday-first offset
  const cells: (HabitCalendar['days'][number] | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...calendar.days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (typeof cells)[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {WEEKDAYS.map((w) => (
          <View key={w.value} style={styles.cell}>
            <AppText variant="caption" color={colors.secondary}>
              {w.short}
            </AppText>
          </View>
        ))}
      </View>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((day, j) => {
            if (!day) return <View key={j} style={styles.cell} />;
            const isToday = day.date === calendar.today;
            const missed = day.isScheduled && !day.isCompleted && !day.isFuture && !isToday;
            const label = `${Number(day.date.slice(8))}-нд ${
              day.isCompleted ? 'биелүүлсэн' : day.isScheduled ? 'төлөвлөсөн' : 'амралт'
            }`;
            return (
              <View key={j} style={styles.cell} accessible accessibilityLabel={label}>
                <View
                  style={[
                    styles.dayCircle,
                    day.isCompleted && { backgroundColor: color },
                    isToday && !day.isCompleted && { borderWidth: 2, borderColor: color },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color={
                      day.isCompleted
                        ? colors.white
                        : day.isScheduled && !day.isFuture
                          ? colors.text
                          : colors.secondary
                    }
                  >
                    {Number(day.date.slice(8))}
                  </AppText>
                </View>
                {missed ? <View style={[styles.dot, { backgroundColor: colors.border }]} /> : null}
                {day.isScheduled && day.isFuture ? (
                  <View style={[styles.dot, { backgroundColor: `${color}66` }]} />
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xxs },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, minHeight: 44 },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
});
