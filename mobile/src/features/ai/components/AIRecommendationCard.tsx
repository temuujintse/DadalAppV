import { StyleSheet, View } from 'react-native';
import { Clock, Sparkles } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DIFFICULTY, describeSchedule } from '@/features/habits/constants';
import { HabitIcon } from '@/features/habits/components/HabitIcon';
import { colors, radius, spacing } from '@/theme';
import type { AIRecommendation } from '@/types/api';

/** One coach proposal: what, why, and Accept / Not for me. */
export function AIRecommendationCard({
  rec,
  onAccept,
  onReject,
  accepting,
  rejecting,
}: {
  rec: AIRecommendation;
  onAccept: () => void;
  onReject: () => void;
  accepting?: boolean;
  rejecting?: boolean;
}) {
  const p = rec.proposal;
  return (
    <Card>
      <View style={styles.head}>
        <HabitIcon icon={p.icon} color={colors.purple} />
        <View style={styles.flex}>
          <AppText variant="heading">{p.title}</AppText>
          <AppText variant="caption" color={colors.secondary}>
            {DIFFICULTY[p.difficulty].label} · {describeSchedule(p.scheduleDays)}
          </AppText>
        </View>
      </View>
      <AppText>{p.description}</AppText>
      <View style={styles.chips}>
        <View style={styles.chip}>
          <Clock size={14} color={colors.purpleText} />
          <AppText variant="caption" color={colors.purpleText}>
            ~{p.estimatedMinutes} мин
          </AppText>
        </View>
      </View>
      <View style={styles.why}>
        <Sparkles size={16} color={colors.purple} />
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.text}>
            {p.reason}
          </AppText>
          <AppText variant="caption" color={colors.secondary}>
            {p.expectedBenefit}
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button title="Хэрэггүй" variant="secondary" onPress={onReject} loading={rejecting} disabled={accepting} />
        </View>
        <View style={styles.flex}>
          <Button title="Дадал болгох" variant="quest" onPress={onAccept} loading={accepting} disabled={rejecting} />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  chips: { flexDirection: 'row', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  why: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
