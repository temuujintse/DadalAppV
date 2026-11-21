import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, ListChecks, Plus, Sparkles, UserPlus } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { InlineError } from '@/components/ui/StateViews';
import { useMe } from '@/features/auth/api';
import { useFamily } from '@/features/family/api';
import { familyUi } from '@/features/family/roles';
import { useHabits } from '@/features/habits/api';
import { HabitCard } from '@/features/habits/components/HabitCard';
import { usePet } from '@/features/pets/api';
import { PetCard } from '@/features/pets/components/PetCard';
import { useQuests } from '@/features/quests/api';
import { DailyQuestCard } from '@/features/quests/components/DailyQuestCard';
import { useMyGamification } from '@/features/gamification/api';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import { formatLongDate, greeting } from '@/utils/date';

export default function HomeScreen() {
  const me = useMe();
  const family = useFamily();
  const todayHabits = useHabits('today');
  const xp = useMyGamification();
  const pet = usePet();
  const quests = useQuests();
  useRefreshOnFocus([
    me.refetch,
    family.refetch,
    todayHabits.refetch,
    xp.refetch,
    pet.refetch,
    quests.refetch,
  ]);
  const now = new Date();

  if (!me.data) return null; // root navigator guarantees `me` before showing tabs
  const { profile } = me.data;
  // Server-calculated level state; /auth/me is the fallback while it loads.
  const g = xp.data ?? {
    level: me.data.gamification.level,
    lifetimeXP: me.data.gamification.lifetimeXP,
    balanceXP: me.data.gamification.balanceXP,
    xpIntoLevel: 0,
    xpForNextLevel: 100,
    bestStreak: 0,
  };
  const canInvite = family.data ? familyUi.canInvite(family.data.myRole) : false;

  const due = todayHabits.data ?? [];
  const done = due.filter((h) => h.today.isCompleted).length;

  const refreshing =
    me.isRefetching || family.isRefetching || todayHabits.isRefetching || xp.isRefetching;
  const onRefresh = () => {
    void me.refetch();
    void family.refetch();
    void todayHabits.refetch();
    void xp.refetch();
    void pet.refetch();
    void quests.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Animated.View entering={FadeInDown.duration(350)} style={styles.headerRow}>
        <View style={styles.headerText}>
          <AppText variant="caption" color={colors.secondary}>
            {formatLongDate(now)}
          </AppText>
          <AppText variant="title" numberOfLines={2}>
            {greeting(now)}, {profile.displayName}!
          </AppText>
        </View>
        <PressableScale
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Профайл"
        >
          <Avatar avatarKey={profile.avatarKey} size={52} />
        </PressableScale>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(40).duration(350)}>
        <PetCard />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(350)}>
        <PressableScale
          onPress={() => router.push('/progress')}
          accessibilityRole="button"
          accessibilityLabel={`${g.level}-р түвшин, ${g.lifetimeXP} XP. Ахицаа харах`}
        >
          <Card>
            <View style={styles.levelRow}>
              <View style={styles.levelBadge}>
                <Sparkles size={18} color={colors.white} />
                <AppText variant="label" color={colors.white}>
                  {g.level}-р түвшин
                </AppText>
              </View>
              <View style={styles.xpTotal}>
                <AnimatedNumber value={g.lifetimeXP} variant="heading" suffix=" XP" />
                <ChevronRight size={18} color={colors.secondary} />
              </View>
            </View>
            <ProgressBar
              progress={g.xpForNextLevel ? g.xpIntoLevel / g.xpForNextLevel : 0}
              accessibilityLabel={`Дараагийн түвшин хүртэл ${g.xpIntoLevel} / ${g.xpForNextLevel} XP`}
            />
            <AppText variant="caption" color={colors.secondary}>
              {g.xpIntoLevel} / {g.xpForNextLevel} XP · дараагийн түвшин хүртэл{' '}
              {g.xpForNextLevel - g.xpIntoLevel} XP · Зарцуулах: {g.balanceXP}
            </AppText>
          </Card>
        </PressableScale>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(350)} style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="heading">Өнөөдрийн дадлууд</AppText>
          {due.length > 0 ? (
            <AppText variant="caption" color={colors.secondary}>
              {done} / {due.length}
            </AppText>
          ) : null}
        </View>
        {due.length > 0 ? (
          <ProgressBar
            progress={done / due.length}
            color={colors.success}
            accessibilityLabel={`Өнөөдрийн ахиц ${done} / ${due.length}`}
          />
        ) : null}
        {due.length > 0 && done === due.length ? (
          <AppText variant="caption" color={colors.successText}>
            Өнөөдрийн бүх дадлаа биелүүллээ. Баяр хүргэе! 🎉
          </AppText>
        ) : null}
        {todayHabits.isPending ? (
          <ListSkeleton rows={3} />
        ) : todayHabits.isError && !todayHabits.data ? (
          <InlineError
            message={errorMessage(todayHabits.error)}
            onRetry={() => void todayHabits.refetch()}
          />
        ) : due.length === 0 ? (
          <PressableScale
            onPress={() => router.push('/habit/new')}
            accessibilityRole="button"
            accessibilityLabel="Дадал нэмэх"
            style={styles.cta}
          >
            <ListChecks size={22} color={colors.primary} />
            <View style={styles.familyText}>
              <AppText variant="bodyStrong">Өнөөдөр хийх дадал алга</AppText>
              <AppText variant="caption" color={colors.secondary}>
                Жижиг дадлаас эхэлцгээе — шинэ дадал нэмэх.
              </AppText>
            </View>
            <Plus size={20} color={colors.primary} />
          </PressableScale>
        ) : (
          due.map((h) => <HabitCard key={h.id} habit={h} />)
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(350)}>
        <DailyQuestCard />
      </Animated.View>

      {family.data ? (
        <Animated.View entering={FadeInDown.delay(160).duration(350)}>
          <PressableScale
            onPress={() => router.navigate('/family')}
            accessibilityRole="button"
            accessibilityLabel={`${family.data.name} — гэр бүлийн дэлгэц`}
          >
            <Card style={styles.familyCard}>
              <Avatar avatarKey={family.data.avatarKey} kind="family" size={52} />
              <View style={styles.familyText}>
                <AppText variant="heading" numberOfLines={1}>
                  {family.data.name}
                </AppText>
                <AppText variant="caption" color={colors.secondary}>
                  {family.data.memberCount} гишүүн · Гэр бүлийн {family.data.gamification.level}-р
                  түвшин · {family.data.gamification.lifetimeXP} XP
                </AppText>
              </View>
              <ChevronRight size={22} color={colors.secondary} />
            </Card>
          </PressableScale>
        </Animated.View>
      ) : null}

      {family.data && family.data.memberCount === 1 && canInvite ? (
        <Animated.View entering={FadeInDown.delay(240).duration(350)}>
          <PressableScale
            onPress={() => router.push('/invite')}
            accessibilityRole="button"
            accessibilityLabel="Гэр бүлийн гишүүдээ урих"
            style={styles.cta}
          >
            <UserPlus size={22} color={colors.primary} />
            <View style={styles.familyText}>
              <AppText variant="bodyStrong">Гэр бүлийн гишүүдээ урих</AppText>
              <AppText variant="caption" color={colors.secondary}>
                Хамтдаа дадал хэвшүүлэх нь илүү амархан.
              </AppText>
            </View>
            <ChevronRight size={20} color={colors.secondary} />
          </PressableScale>
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerText: { flex: 1, gap: 2 },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  xpTotal: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  familyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  familyText: { flex: 1, gap: 2 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    padding: spacing.lg,
  },
});
