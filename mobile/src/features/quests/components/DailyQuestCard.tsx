import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ChevronRight, Target } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { colors, spacing } from '@/theme';
import { useQuests } from '../api';
import { QUEST_ICONS } from '../icons';

/**
 * Home dashboard "daily quest": the most relevant one — a reward waiting to be claimed first,
 * otherwise the closest unfinished daily quest.
 */
export function DailyQuestCard() {
  const quests = useQuests();
  if (!quests.data) return null;

  const daily = quests.data.filter((q) => q.period === 'DAILY');
  const ready = daily.filter((q) => q.status === 'COMPLETED');
  const open = daily
    .filter((q) => q.status === 'IN_PROGRESS')
    .sort((a, b) => b.progress / b.target - a.progress / a.target);
  const quest = ready[0] ?? open[0];
  const claimedAll = daily.length > 0 && daily.every((q) => q.status === 'CLAIMED');
  if (!quest && !claimedAll) return null;

  const Icon = quest ? (QUEST_ICONS[quest.icon] ?? Target) : Target;

  return (
    <PressableScale
      onPress={() => router.navigate('/quests')}
      accessibilityRole="button"
      accessibilityLabel={quest ? `Өдрийн даалгавар: ${quest.title}` : 'Өдрийн даалгаврууд дууссан'}
    >
      <Card style={[styles.card, ready.length > 0 && styles.ready]}>
        <View style={styles.icon}>
          <Icon size={22} color={colors.purple} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.purpleText}>
            {ready.length > 0
              ? `${ready.length} шагнал авахад бэлэн`
              : claimedAll
                ? 'Өнөөдрийн бүх даалгавар дууссан 🎉'
                : 'Өдрийн даалгавар'}
          </AppText>
          {quest ? (
            <>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {quest.title}
              </AppText>
              <View style={styles.progressRow}>
                <View style={styles.flex}>
                  <ProgressBar
                    progress={quest.progress / quest.target}
                    color={colors.purple}
                    height={6}
                  />
                </View>
                <AppText variant="caption" color={colors.secondary}>
                  {quest.progress}/{quest.target}
                </AppText>
              </View>
            </>
          ) : null}
        </View>
        <ChevronRight size={20} color={colors.secondary} />
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ready: { borderWidth: 1.5, borderColor: colors.purple },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1, gap: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
