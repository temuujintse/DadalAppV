import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Archive, ListChecks, Plus } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { HabitScope, useHabits } from '@/features/habits/api';
import { HabitCard } from '@/features/habits/components/HabitCard';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';

type Filter = Exclude<HabitScope, 'today'>;

export default function HabitsScreen() {
  const [filter, setFilter] = useState<Filter>('all');
  const [archived, setArchived] = useState(false);
  const habits = useHabits(filter, archived ? 'ARCHIVED' : 'ACTIVE');
  useRefreshOnFocus([habits.refetch]);

  const list = habits.data ?? [];
  const dueToday = list.filter((h) => h.canComplete && h.today.isScheduled);
  const doneToday = dueToday.filter((h) => h.today.isCompleted).length;

  return (
    <Screen refreshing={habits.isRefetching} onRefresh={() => void habits.refetch()}>
      <View style={styles.header}>
        <AppText variant="title">{archived ? 'Архив' : 'Дадлууд'}</AppText>
        {!archived ? (
          <Button
            title="Шинэ"
            variant="ghost"
            icon={<Plus size={18} color={colors.primary} />}
            onPress={() => router.push('/habit/new')}
          />
        ) : null}
      </View>

      <Segmented
        accessibilityLabel="Шүүлтүүр"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Бүгд' },
          { value: 'personal', label: 'Хувийн' },
          { value: 'family', label: 'Гэр бүл' },
        ]}
      />

      {!archived && dueToday.length > 0 ? (
        <View style={styles.progress}>
          <View style={styles.progressText}>
            <AppText variant="label">Өнөөдөр</AppText>
            <AppText variant="caption" color={colors.secondary}>
              {doneToday} / {dueToday.length} биелсэн
            </AppText>
          </View>
          <ProgressBar
            progress={doneToday / dueToday.length}
            color={colors.success}
            accessibilityLabel={`Өнөөдөр ${doneToday} / ${dueToday.length} биелсэн`}
          />
        </View>
      ) : null}

      {habits.isPending ? (
        <ListSkeleton rows={4} />
      ) : habits.isError ? (
        <ErrorState
          message={errorMessage(habits.error)}
          onRetry={() => void habits.refetch()}
          retrying={habits.isFetching}
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={28} color={colors.primary} />}
          title={archived ? 'Архив хоосон байна' : 'Эхний дадлаа нэмээрэй'}
          message={
            archived
              ? 'Архивласан дадлууд энд харагдана.'
              : 'Жижиг, өдөр бүр хийж чадах зүйлээс эхлэх нь хамгийн амжилттай.'
          }
          action={
            archived ? undefined : (
              <Button title="Дадал нэмэх" onPress={() => router.push('/habit/new')} />
            )
          }
        />
      ) : (
        <View style={styles.list}>
          {list.map((h, i) => (
            <Animated.View
              key={h.id}
              entering={FadeInDown.delay(Math.min(i, 8) * 35).duration(280)}
              layout={LinearTransition.duration(200)}
            >
              <HabitCard habit={h} />
            </Animated.View>
          ))}
        </View>
      )}

      <Pressable
        onPress={() => setArchived((a) => !a)}
        style={styles.archiveToggle}
        accessibilityRole="button"
      >
        <Archive size={16} color={colors.secondary} />
        <AppText variant="caption" color={colors.secondary}>
          {archived ? 'Идэвхтэй дадлууд руу буцах' : 'Архивласан дадлууд'}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { gap: spacing.xs },
  progressText: { flexDirection: 'row', justifyContent: 'space-between' },
  list: { gap: spacing.sm },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
});
