import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Pencil } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import {
  newIdempotencyKey,
  useCompleteHabit,
  useDeleteHabit,
  useHabit,
  useHabitCalendar,
  useUndoCompletion,
  useUpdateHabit,
} from '@/features/habits/api';
import { CompleteButton } from '@/features/habits/components/CompleteButton';
import { HabitIcon } from '@/features/habits/components/HabitIcon';
import { MonthCalendar, monthTitle } from '@/features/habits/components/MonthCalendar';
import { StreakBadge } from '@/features/habits/components/StreakBadge';
import { COMPLETION_MODE, describeSchedule, DIFFICULTY } from '@/features/habits/constants';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabit(id);
  const [month, setMonth] = useState<string | undefined>(undefined);
  const calendar = useHabitCalendar(id, month);
  const complete = useCompleteHabit();
  const undo = useUndoCompletion();
  const update = useUpdateHabit(id);
  const remove = useDeleteHabit();
  useRefreshOnFocus([habit.refetch, calendar.refetch]);

  if (habit.isPending) return <LoadingState />;
  if (habit.isError) {
    return (
      <Screen>
        <BackHeader />
        <ErrorState
          message={errorMessage(habit.error)}
          onRetry={() => void habit.refetch()}
          retrying={habit.isFetching}
        />
      </Screen>
    );
  }

  const h = habit.data;
  const { today } = h;
  const currentMonth = today.date.slice(0, 7);
  const shownMonth = month ?? currentMonth;
  const archived = h.status === 'ARCHIVED';

  const statusText = archived
    ? 'Архивласан дадал'
    : !today.isScheduled
      ? 'Өнөөдөр амрах өдөр 🌙'
      : today.isCompleted
        ? h.pendingSync
          ? 'Өнөөдөр биелүүлсэн · синк хүлээж байна'
          : today.completedBy && !today.canUndo
            ? `${today.completedBy.displayName} өнөөдөр биелүүлсэн`
            : 'Өнөөдөр биелүүлсэн. Гайхалтай! 🎉'
        : h.canComplete
          ? 'Өнөөдөр биелүүлэхэд бэлэн үү?'
          : 'Энэ дадал танд оноогдоогүй';

  const onComplete = () =>
    complete.mutate(
      { habitId: h.id, idempotencyKey: newIdempotencyKey(), title: h.title },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          void calendar.refetch();
        },
        onError: (err) => Alert.alert('Тэмдэглэж чадсангүй', errorMessage(err)),
      },
    );

  const onUndo = () =>
    Alert.alert('Буцаах уу?', 'Өнөөдрийн тэмдэглэгээг цуцална.', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Буцаах',
        onPress: () =>
          undo.mutate(
            { habitId: h.id, completionId: today.completionId, title: h.title },
            {
              onSuccess: () => void calendar.refetch(),
              onError: (err) => Alert.alert('Буцааж чадсангүй', errorMessage(err)),
            },
          ),
      },
    ]);

  const onDelete = () =>
    Alert.alert(
      'Дадлыг устгах уу?',
      'Дадал жагсаалтаас алга болно. Өмнөх биелэлтийн түүх хадгалагдана.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Устгах',
          style: 'destructive',
          onPress: () =>
            remove.mutate(h.id, {
              onSuccess: () => router.back(),
              onError: (err) => Alert.alert('Устгаж чадсангүй', errorMessage(err)),
            }),
        },
      ],
    );

  const badges = [
    h.type === 'FAMILY' ? `Гэр бүл · ${COMPLETION_MODE[h.completionMode!].label}` : 'Хувийн',
    DIFFICULTY[h.difficulty].label,
    describeSchedule(h.scheduleDays),
  ];

  return (
    <Screen
      refreshing={habit.isRefetching}
      onRefresh={() => {
        void habit.refetch();
        void calendar.refetch();
      }}
    >
      <BackHeader
        right={
          h.canManage ? (
            <Pressable
              onPress={() => router.push(`/habit/${h.id}/edit`)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Дадал засах"
            >
              <Pencil size={20} color={colors.text} />
            </Pressable>
          ) : null
        }
      />

      <Animated.View entering={FadeInDown.duration(300)} style={styles.hero}>
        <HabitIcon icon={h.icon} color={h.color} size={72} />
        <AppText variant="title" align="center">
          {h.title}
        </AppText>
        {h.description ? (
          <AppText color={colors.secondary} align="center">
            {h.description}
          </AppText>
        ) : null}
        <View style={styles.badges}>
          {badges.map((b) => (
            <View key={b} style={styles.badge}>
              <AppText variant="caption" color={colors.secondary}>
                {b}
              </AppText>
            </View>
          ))}
        </View>
      </Animated.View>

      <Card style={styles.todayCard}>
        <View style={styles.todayText}>
          <AppText variant="caption" color={colors.secondary}>
            Өнөөдөр
          </AppText>
          <AppText variant="bodyStrong">{statusText}</AppText>
          {today.canUndo ? (
            <Pressable
              onPress={onUndo}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Өнөөдрийн тэмдэглэгээг буцаах"
              style={styles.undo}
            >
              <AppText variant="caption" color={colors.primaryText}>
                Буцаах
              </AppText>
            </Pressable>
          ) : null}
        </View>
        {h.canComplete || today.isCompleted ? (
          <CompleteButton
            size={60}
            done={today.isCompleted}
            color={h.color}
            rest={!today.isScheduled}
            busy={complete.isPending || undo.isPending}
            disabled={today.isCompleted || !h.canComplete}
            onPress={onComplete}
            accessibilityLabel={today.isCompleted ? 'Биелүүлсэн' : 'Өнөөдөр биелүүлэх'}
          />
        ) : null}
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <AppText variant="caption" color={colors.secondary}>
            {h.completionMode === 'SHARED' ? 'Гэр бүлийн streak' : 'Одоогийн streak'}
          </AppText>
          <StreakBadge days={h.streak.current} size="lg" />
        </Card>
        <Card style={styles.stat}>
          <AppText variant="caption" color={colors.secondary}>
            Хамгийн урт
          </AppText>
          <AppText variant="heading">{h.streak.longest} өдөр</AppText>
        </Card>
      </View>

      {h.todayByMember ? (
        <Card>
          <AppText variant="label">Өнөөдөр хэн хийсэн бэ?</AppText>
          {h.todayByMember.map((m) => (
            <View key={m.userId} style={styles.memberRow}>
              <Avatar avatarKey={m.avatarKey} size={32} />
              <AppText style={styles.flex}>{m.displayName}</AppText>
              <AppText variant="caption" color={m.completed ? colors.successText : colors.secondary}>
                {m.completed ? 'Биелүүлсэн ✓' : 'Хүлээгдэж байна'}
              </AppText>
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <View style={styles.monthHeader}>
          <Pressable
            onPress={() => setMonth(shiftMonth(shownMonth, -1))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Өмнөх сар"
          >
            <ChevronLeft size={22} color={colors.text} />
          </Pressable>
          <AppText variant="label">{monthTitle(shownMonth)}</AppText>
          <Pressable
            onPress={() => setMonth(shiftMonth(shownMonth, 1))}
            disabled={shownMonth >= currentMonth}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Дараагийн сар"
            style={shownMonth >= currentMonth ? styles.disabled : undefined}
          >
            <ChevronRight size={22} color={colors.text} />
          </Pressable>
        </View>
        {calendar.data ? (
          <>
            <MonthCalendar calendar={calendar.data} color={h.color} />
            <AppText variant="caption" color={colors.secondary} align="center">
              Энэ сард {calendar.data.completedCount} / {calendar.data.scheduledCount} төлөвлөсөн
              өдөр биелүүлсэн
            </AppText>
          </>
        ) : calendar.isError ? (
          <ErrorState
            message={errorMessage(calendar.error)}
            onRetry={() => void calendar.refetch()}
          />
        ) : calendar.fetchStatus === 'paused' ? (
          <AppText variant="caption" color={colors.secondary} align="center">
            Холбогдмогц календарь харагдана.
          </AppText>
        ) : (
          <LoadingState />
        )}
      </Card>

      {h.type === 'FAMILY' ? (
        <Card>
          <AppText variant="label">Оноогдсон гишүүд</AppText>
          <View style={styles.assignees}>
            {h.assignees.map((a) => (
              <View key={a.userId} style={styles.assignee}>
                <Avatar avatarKey={a.avatarKey} size={28} />
                <AppText variant="caption">{a.displayName}</AppText>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      {h.canManage ? (
        <View style={styles.actions}>
          <Button
            title={archived ? 'Дахин идэвхжүүлэх' : 'Архивлах'}
            variant="secondary"
            loading={update.isPending}
            onPress={() =>
              update.mutate(
                { status: archived ? 'ACTIVE' : 'ARCHIVED' },
                { onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)) },
              )
            }
          />
          <Button title="Устгах" variant="danger" loading={remove.isPending} onPress={onDelete} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  undo: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  hero: { alignItems: 'center', gap: spacing.xs },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  badge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  todayCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  todayText: { flex: 1, gap: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, gap: spacing.xxs },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disabled: { opacity: 0.3 },
  assignees: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  assignee: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  actions: { gap: spacing.sm },
});
