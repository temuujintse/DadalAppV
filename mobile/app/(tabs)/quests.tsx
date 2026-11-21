import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Clock, Target } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Screen } from '@/components/ui/Screen';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { useQuests } from '@/features/quests/api';
import { QuestCard } from '@/features/quests/components/QuestCard';
import { useNow } from '@/hooks/useNow';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';
import type { Quest } from '@/types/api';

function resetsIn(iso: string, now: Date): string {
  const min = Math.max(1, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цаг`;
  return `${Math.floor(h / 24)} өдөр`;
}

export default function QuestsScreen() {
  const quests = useQuests();
  const now = useNow(60_000);
  useRefreshOnFocus([quests.refetch]);

  if (quests.isPending || quests.isError) {
    return (
      <Screen>
        <AppText variant="title">Даалгавар</AppText>
        {quests.isPending ? (
          <ListSkeleton rows={3} trailing={false} />
        ) : (
          <ErrorState
            message={errorMessage(quests.error)}
            onRetry={() => void quests.refetch()}
            retrying={quests.isFetching}
          />
        )}
      </Screen>
    );
  }

  // Each group shares one period, so one reset countdown per group is accurate.
  const groups: { title: string; items: Quest[] }[] = [
    {
      title: 'Өнөөдрийн даалгавар',
      items: quests.data.filter((q) => q.scope === 'USER' && q.period === 'DAILY'),
    },
    {
      title: 'Гэр бүл · өнөөдөр',
      items: quests.data.filter((q) => q.scope === 'FAMILY' && q.period === 'DAILY'),
    },
    {
      title: 'Энэ долоо хоног',
      items: quests.data.filter((q) => q.period === 'WEEKLY'),
    },
  ].filter((g) => g.items.length > 0);

  const ready = quests.data.filter((q) => q.status === 'COMPLETED').length;

  return (
    <Screen refreshing={quests.isRefetching} onRefresh={() => void quests.refetch()}>
      <View style={styles.header}>
        <AppText variant="title">Даалгавар</AppText>
        {ready > 0 ? (
          <AppText variant="label" color={colors.purpleText}>
            {ready} шагнал хүлээж байна
          </AppText>
        ) : null}
      </View>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Target size={28} color={colors.primary} />}
          title="Одоогоор даалгавар алга"
          message="Шинэ даалгаврууд удахгүй нэмэгдэнэ."
        />
      ) : (
        groups.map((g, gi) => (
          <Animated.View
            key={g.title}
            entering={FadeInDown.delay(gi * 80).duration(300)}
            style={styles.section}
          >
            <View style={styles.sectionHeader}>
              <AppText variant="heading">{g.title}</AppText>
              <View style={styles.reset}>
                <Clock size={14} color={colors.secondary} />
                <AppText variant="caption" color={colors.secondary}>
                  {resetsIn(g.items[0].resetsAt, now)}
                </AppText>
              </View>
            </View>
            {g.items.map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
          </Animated.View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reset: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
