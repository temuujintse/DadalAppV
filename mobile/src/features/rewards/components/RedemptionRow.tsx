import { Alert, StyleSheet, View } from 'react-native';
import { Gift } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Redemption, RedemptionStatus } from '@/types/api';
import { RedemptionAction, useRedemptionAction } from '../api';
import { REWARD_ICONS } from '../icons';

export const STATUS: Record<RedemptionStatus, { label: string; color: string }> = {
  PENDING: { label: 'Хүлээгдэж байна', color: colors.warning },
  APPROVED: { label: 'Зөвшөөрсөн', color: colors.success },
  REDEEMED: { label: 'Олгосон', color: colors.success },
  REJECTED: { label: 'Татгалзсан', color: colors.secondary },
  CANCELLED: { label: 'Цуцалсан', color: colors.secondary },
};

/** One reward request with the actions the server says the caller may take. */
export function RedemptionRow({
  item,
  showRequester,
}: {
  item: Redemption;
  showRequester: boolean;
}) {
  const action = useRedemptionAction();
  const Icon = REWARD_ICONS[item.reward.icon] ?? Gift;
  const st = STATUS[item.status];

  const run = (a: RedemptionAction) =>
    action.mutate(
      { id: item.id, action: a },
      { onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)) },
    );

  const confirmApprove = () =>
    Alert.alert(
      'Зөвшөөрөх үү?',
      `${item.requester.displayName} · ${item.xpCost} XP зарцуулагдана. Түвшин буурахгүй.`,
      [
        { text: 'Болих', style: 'cancel' },
        { text: 'Зөвшөөрөх', onPress: () => run('approve') },
      ],
    );

  return (
    <View style={styles.row}>
      <View style={styles.top}>
        <View style={styles.icon}>
          <Icon size={20} color={colors.purple} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.reward.title}
          </AppText>
          <View style={styles.meta}>
            {showRequester ? (
              <>
                <Avatar avatarKey={item.requester.avatarKey} photoUrl={item.requester.photoUrl} size={18} />
                <AppText variant="caption" color={colors.secondary}>
                  {item.requester.displayName} ·
                </AppText>
              </>
            ) : null}
            <AppText variant="caption" color={colors.secondary}>
              {item.xpCost} XP
            </AppText>
          </View>
        </View>
        <AppText variant="caption" color={st.color}>
          {st.label}
        </AppText>
      </View>
      {item.decisionNote ? (
        <AppText variant="caption" color={colors.secondary}>
          “{item.decisionNote}”
        </AppText>
      ) : null}
      {item.canDecide ? (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              title="Татгалзах"
              variant="secondary"
              disabled={action.isPending}
              onPress={() => run('reject')}
            />
          </View>
          <View style={styles.flex}>
            <Button title="Зөвшөөрөх" loading={action.isPending} onPress={confirmApprove} />
          </View>
        </View>
      ) : null}
      {item.canComplete ? (
        <Button
          title="Олгосон гэж тэмдэглэх"
          variant="secondary"
          loading={action.isPending}
          onPress={() => run('complete')}
        />
      ) : null}
      {item.canCancel ? (
        <Button title="Хүсэлтээ цуцлах" variant="ghost" onPress={() => run('cancel')} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
