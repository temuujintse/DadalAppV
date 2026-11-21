import { router } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { CloudUpload, Users } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Habit } from '@/types/api';
import { newIdempotencyKey, useCompleteHabit, useUndoCompletion } from '../api';
import { DIFFICULTY } from '../constants';
import { CompleteButton } from './CompleteButton';
import { HabitIcon } from './HabitIcon';
import { StreakBadge } from './StreakBadge';

/** Compact habit row: icon · title · one meta line · completion toggle. */
export function HabitCard({ habit }: { habit: Habit }) {
  const complete = useCompleteHabit();
  const undo = useUndoCompletion();
  const { today } = habit;
  const doneBySomeoneElse =
    today.isCompleted && today.completedBy && !today.canUndo && habit.completionMode === 'SHARED';

  const onToggle = () => {
    if (!today.isCompleted) {
      complete.mutate(
        { habitId: habit.id, idempotencyKey: newIdempotencyKey(), title: habit.title },
        { onError: (err) => Alert.alert('Тэмдэглэж чадсангүй', errorMessage(err)) },
      );
      return;
    }
    if (today.canUndo) {
      const queued = today.completionId === null;
      Alert.alert(
        'Буцаах уу?',
        queued
          ? 'Синк хүлээж буй өнөөдрийн тэмдэглэгээг цуцална.'
          : 'Өнөөдрийн тэмдэглэгээг цуцална.',
        [
          { text: 'Болих', style: 'cancel' },
          {
            text: 'Буцаах',
            onPress: () =>
              undo.mutate(
                { habitId: habit.id, completionId: today.completionId, title: habit.title },
                { onError: (err) => Alert.alert('Буцааж чадсангүй', errorMessage(err)) },
              ),
          },
        ],
      );
    }
  };

  const meta: string[] = [`+${habit.xpReward} XP`, DIFFICULTY[habit.difficulty].label];
  if (habit.pendingSync) meta.unshift('Синк хүлээж байна');
  else if (!today.isScheduled) meta.unshift('Өнөөдөр амрана');
  else if (doneBySomeoneElse) meta.unshift(`${today.completedBy!.displayName} биелүүлсэн`);

  return (
    <PressableScale
      onPress={() => router.push(`/habit/${habit.id}`)}
      style={[styles.card, today.isCompleted && styles.cardDone]}
      accessibilityRole="button"
      accessibilityLabel={`${habit.title}, дэлгэрэнгүй`}
    >
      <HabitIcon icon={habit.icon} color={habit.color} />
      <View style={styles.text}>
        <AppText
          variant="bodyStrong"
          numberOfLines={1}
          style={today.isCompleted ? styles.titleDone : undefined}
        >
          {habit.title}
        </AppText>
        <View style={styles.metaRow}>
          <StreakBadge days={habit.streak.current} />
          {habit.pendingSync ? <CloudUpload size={14} color={colors.warning} /> : null}
          {habit.type === 'FAMILY' ? <Users size={14} color={colors.secondary} /> : null}
          <AppText variant="caption" color={colors.secondary} numberOfLines={1} style={styles.meta}>
            {meta.join(' · ')}
          </AppText>
        </View>
      </View>
      {habit.canComplete ? (
        <CompleteButton
          done={today.isCompleted}
          color={habit.color}
          rest={!today.isScheduled}
          busy={complete.isPending || undo.isPending}
          disabled={today.isCompleted && !today.canUndo}
          onPress={onToggle}
          accessibilityLabel={
            today.isCompleted ? `${habit.title} — биелүүлсэн` : `${habit.title} — биелүүлэх`
          }
        />
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  cardDone: { opacity: 0.85 },
  text: { flex: 1, gap: spacing.xxs },
  titleDone: { color: colors.secondary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { flex: 1 },
});
