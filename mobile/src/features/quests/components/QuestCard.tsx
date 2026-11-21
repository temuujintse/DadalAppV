import * as Haptics from 'expo-haptics';
import { Alert, StyleSheet, View } from 'react-native';
import { Check, Target } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Quest } from '@/types/api';
import { useClaimQuest } from '../api';
import { QUEST_ICONS } from '../icons';

/** Purple is the quest accent (design tokens: Purple = quests & special rewards). */
export function QuestCard({ quest }: { quest: Quest }) {
  const claim = useClaimQuest();
  const Icon = QUEST_ICONS[quest.icon] ?? Target;
  const claimed = quest.status === 'CLAIMED';
  const ready = quest.status === 'COMPLETED';
  const reward = [
    quest.xpReward > 0 ? `+${quest.xpReward} XP` : null,
    quest.familyXpReward > 0 ? `Гэр бүл +${quest.familyXpReward} XP` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      style={[styles.card, ready && styles.ready, claimed && styles.claimed]}
      accessible={!ready}
      accessibilityLabel={`${quest.title}. ${quest.progress} / ${quest.target}. ${
        claimed ? 'Шагнал авсан' : ready ? 'Шагнал авах боломжтой' : 'Явагдаж байна'
      }`}
    >
      <View style={styles.row}>
        <View style={[styles.icon, claimed && styles.iconClaimed]}>
          {claimed ? (
            <Check size={22} color={colors.white} strokeWidth={3} />
          ) : (
            <Icon size={22} color={colors.purple} />
          )}
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {quest.title}
          </AppText>
          <AppText variant="caption" color={colors.secondary} numberOfLines={2}>
            {quest.description}
          </AppText>
        </View>
        <AppText variant="label" color={colors.purpleText}>
          {reward}
        </AppText>
      </View>

      <View style={styles.progressRow}>
        <View style={styles.flex}>
          <ProgressBar
            progress={quest.progress / quest.target}
            color={claimed ? colors.success : colors.purple}
            height={8}
          />
        </View>
        <AppText variant="caption" color={colors.secondary}>
          {quest.progress} / {quest.target}
        </AppText>
      </View>

      {ready ? (
        <Button
          title="Шагнал авах"
          variant="quest"
          loading={claim.isPending}
          onPress={() =>
            claim.mutate(quest.id, {
              onSuccess: () =>
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
              onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)),
            })
          }
        />
      ) : claimed && quest.claimedBy ? (
        <View style={styles.claimer}>
          <Avatar avatarKey={quest.claimedBy.avatarKey} size={22} />
          <AppText variant="caption" color={colors.successText}>
            {quest.scope === 'FAMILY'
              ? `${quest.claimedBy.displayName} шагналыг авсан`
              : 'Шагнал авсан'}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  ready: { borderColor: colors.purple, backgroundColor: colors.purpleSoft },
  claimed: { opacity: 0.8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconClaimed: { backgroundColor: colors.success },
  text: { flex: 1, gap: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  claimer: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
