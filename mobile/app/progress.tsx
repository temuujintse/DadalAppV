import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Lock, Sparkles, Trophy } from 'lucide-react-native';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { useAchievements, useMyGamification, useXpHistory } from '@/features/gamification/api';
import { ACHIEVEMENT_ICONS } from '@/features/gamification/icons';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Achievement, XpTransaction } from '@/types/api';

/** Personal progress: level, stats, achievements and the XP ledger. */
export default function ProgressScreen() {
  const me = useMyGamification();
  const achievements = useAchievements();
  const history = useXpHistory();
  useRefreshOnFocus([me.refetch, achievements.refetch, history.refetch]);

  const refreshing = me.isRefetching || achievements.isRefetching || history.isRefetching;
  const onRefresh = () => {
    void me.refetch();
    void achievements.refetch();
    void history.refetch();
  };

  if (me.isPending) return <LoadingState />;
  if (me.isError) {
    return (
      <Screen>
        <BackHeader title="Миний ахиц" />
        <ErrorState message={errorMessage(me.error)} onRetry={() => void me.refetch()} />
      </Screen>
    );
  }
  const g = me.data;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <BackHeader title="Миний ахиц" />

      <Animated.View entering={FadeInDown.duration(300)}>
        <Card style={styles.hero}>
          <View style={styles.levelBubble}>
            <Sparkles size={20} color={colors.white} />
            <AppText variant="display" color={colors.white}>
              {g.level}
            </AppText>
          </View>
          <AppText variant="caption" color={colors.secondary}>
            Түвшин
          </AppText>
          <AnimatedNumber value={g.lifetimeXP} variant="title" suffix=" XP" />
          <ProgressBar
            progress={g.xpIntoLevel / g.xpForNextLevel}
            accessibilityLabel={`Дараагийн түвшин хүртэл ${g.xpIntoLevel} / ${g.xpForNextLevel} XP`}
          />
          <AppText variant="caption" color={colors.secondary}>
            {g.level + 1}-р түвшин хүртэл {g.xpForNextLevel - g.xpIntoLevel} XP үлдлээ
          </AppText>
        </Card>
      </Animated.View>

      <View style={styles.statsGrid}>
        <Stat label="Нийт биелэлт" value={g.totalCompletions} />
        <Stat label="Идэвхтэй өдөр" value={g.completionDays} />
        <Stat label="Шилдэг streak" value={g.bestStreak} suffix=" өдөр" />
        <Stat label="Зарцуулах XP" value={g.balanceXP} />
      </View>

      <View style={styles.sectionHeader}>
        <AppText variant="heading">Амжилтууд</AppText>
        <AppText variant="caption" color={colors.secondary}>
          {g.achievementsUnlocked} / {g.achievementsTotal}
        </AppText>
      </View>
      {achievements.data ? (
        <View style={styles.achievementGrid}>
          {achievements.data.map((a) => (
            <AchievementTile key={a.id} achievement={a} />
          ))}
        </View>
      ) : achievements.isError ? (
        <ErrorState
          message={errorMessage(achievements.error)}
          onRetry={() => void achievements.refetch()}
        />
      ) : (
        <ListSkeleton rows={3} trailing={false} />
      )}

      <AppText variant="heading">XP түүх</AppText>
      {history.data && history.data.length > 0 ? (
        <Card style={styles.history}>
          {history.data.map((t, i) => (
            <HistoryRow key={t.id} tx={t} last={i === history.data.length - 1} />
          ))}
        </Card>
      ) : history.data ? (
        <AppText color={colors.secondary}>Дадлаа биелүүлэхэд XP энд бүртгэгдэнэ.</AppText>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) {
  return (
    <Card style={styles.stat}>
      <AppText variant="caption" color={colors.secondary}>
        {label}
      </AppText>
      <AppText variant="heading">
        {value}
        {suffix}
      </AppText>
    </Card>
  );
}

function AchievementTile({ achievement: a }: { achievement: Achievement }) {
  const unlocked = Boolean(a.unlockedAt);
  const Icon = ACHIEVEMENT_ICONS[a.icon] ?? Trophy;
  return (
    <View
      style={[styles.tile, unlocked && styles.tileUnlocked]}
      accessible
      accessibilityLabel={`${a.title}. ${a.description} ${
        unlocked ? 'Нээгдсэн' : `${a.progress} / ${a.threshold}`
      }`}
    >
      <View
        style={[
          styles.tileIcon,
          { backgroundColor: unlocked ? colors.purple : colors.surfaceMuted },
        ]}
      >
        {unlocked ? (
          <Icon size={22} color={colors.white} />
        ) : (
          <Lock size={18} color={colors.secondary} />
        )}
      </View>
      <AppText variant="label" align="center" numberOfLines={2}>
        {a.title}
      </AppText>
      {unlocked ? (
        <AppText variant="caption" color={colors.purpleText}>
          +{a.xpReward} XP
        </AppText>
      ) : (
        <View style={styles.tileProgress}>
          <ProgressBar progress={a.progress / a.threshold} height={6} color={colors.purple} />
          <AppText variant="caption" color={colors.secondary}>
            {a.progress} / {a.threshold}
          </AppText>
        </View>
      )}
    </View>
  );
}

function HistoryRow({ tx, last }: { tx: XpTransaction; last: boolean }) {
  const positive = tx.amount > 0;
  const date = new Date(tx.createdAt);
  return (
    <View style={[styles.historyRow, !last && styles.historyDivider]}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {tx.title}
        </AppText>
        <AppText variant="caption" color={colors.secondary}>
          {date.getMonth() + 1}-р сарын {date.getDate()}, {String(date.getHours()).padStart(2, '0')}
          :{String(date.getMinutes()).padStart(2, '0')}
        </AppText>
      </View>
      <AppText variant="label" color={positive ? colors.successText : colors.secondary}>
        {positive ? '+' : ''}
        {tx.amount} XP
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs },
  levelBubble: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { flexBasis: '47%', flexGrow: 1, gap: spacing.xxs },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: spacing.xxs,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    opacity: 0.8,
  },
  tileUnlocked: { opacity: 1, borderWidth: 1.5, borderColor: colors.purpleSoft },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileProgress: { alignSelf: 'stretch', alignItems: 'center', gap: 2 },
  history: { gap: 0, paddingVertical: spacing.xs },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  historyDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1 },
});
