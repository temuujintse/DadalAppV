import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Gift, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { useFamily } from '@/features/family/api';
import { familyUi } from '@/features/family/roles';
import { useMyGamification } from '@/features/gamification/api';
import { useDeleteReward, useRedeem, useRedemptions, useRewards } from '@/features/rewards/api';
import { RedemptionRow } from '@/features/rewards/components/RedemptionRow';
import { RewardFormSheet } from '@/features/rewards/components/RewardFormSheet';
import { REWARD_ICONS } from '@/features/rewards/icons';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Reward } from '@/types/api';

type RewardsView = 'catalog' | 'requests';

export default function RewardsScreen() {
  const family = useFamily();
  const manager = family.data ? familyUi.canEditFamily(family.data.myRole) : false;
  const rewards = useRewards();
  const mine = useRedemptions('mine');
  const all = useRedemptions('family', manager);
  const xp = useMyGamification();
  const redeem = useRedeem();
  const remove = useDeleteReward();
  const [tab, setTab] = useState<RewardsView>('catalog');
  const [editing, setEditing] = useState<Reward | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  useRefreshOnFocus([rewards.refetch, mine.refetch, all.refetch, xp.refetch]);

  const requests = (manager ? all.data : mine.data) ?? [];
  const pending = requests.filter((r) => r.status === 'PENDING');
  const toHandOver = requests.filter((r) => r.status === 'APPROVED');
  const history = requests.filter((r) => r.status !== 'PENDING' && r.status !== 'APPROVED');
  const actionable = manager ? pending.length + toHandOver.length : pending.length;

  const refreshing = rewards.isRefetching || mine.isRefetching || all.isRefetching;
  const onRefresh = () => {
    void rewards.refetch();
    void mine.refetch();
    if (manager) void all.refetch();
    void xp.refetch();
  };

  const confirmRedeem = (r: Reward) =>
    Alert.alert(
      r.title,
      `${r.xpCost} XP. Эцэг эх зөвшөөрсний дараа XP зарцуулагдана. Хүсэлт илгээх үү?`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Илгээх',
          onPress: () =>
            redeem.mutate(
              { rewardId: r.id },
              {
                onSuccess: () => {
                  setTab('requests');
                  Alert.alert(
                    'Хүсэлт илгээлээ',
                    manager
                      ? 'Хүсэлт «Хүсэлтүүд» хэсэгт харагдана.'
                      : 'Эцэг эх тань удахгүй шийдвэрлэнэ.',
                  );
                },
                onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)),
              },
            ),
        },
      ],
    );

  const confirmDelete = (r: Reward) =>
    Alert.alert('Шагналыг устгах уу?', 'Хүлээгдэж буй хүсэлтүүд цуцлагдана.', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Устгах',
        style: 'destructive',
        onPress: () =>
          remove.mutate(r.id, { onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)) }),
      },
    ]);

  const available = rewards.data?.[0]?.availableXP ?? xp.data?.balanceXP ?? 0;

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.header}>
        <AppText variant="title">Шагнал</AppText>
        {manager ? (
          <Button
            title="Нэмэх"
            variant="ghost"
            icon={<Plus size={18} color={colors.primary} />}
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
        ) : null}
      </View>

      <Card style={styles.balance}>
        <View style={styles.balanceIcon}>
          <Sparkles size={22} color={colors.white} />
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.secondary}>
            Зарцуулах боломжтой
          </AppText>
          <AnimatedNumber value={available} variant="title" suffix=" XP" />
        </View>
        {pending.length > 0 && !manager ? (
          <AppText variant="caption" color={colors.warning}>
            {pending.length} хүсэлт хүлээгдэж байна
          </AppText>
        ) : null}
      </Card>

      <Segmented
        accessibilityLabel="Харагдац"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'catalog', label: 'Шагналууд' },
          {
            value: 'requests',
            label: actionable > 0 ? `Хүсэлтүүд (${actionable})` : 'Хүсэлтүүд',
          },
        ]}
      />

      {tab === 'catalog' ? (
        rewards.isPending ? (
          <ListSkeleton rows={3} />
        ) : rewards.isError ? (
          <ErrorState
            message={errorMessage(rewards.error)}
            onRetry={() => void rewards.refetch()}
          />
        ) : rewards.data.length === 0 ? (
          <EmptyState
            icon={<Gift size={28} color={colors.primary} />}
            title="Шагнал хараахан алга"
            message={
              manager
                ? 'Гэр бүлдээ таалагдах шагнал нэмээрэй — кино үзэх, дуртай хоол, хамтдаа зугаалах.'
                : 'Эцэг эх тань удахгүй шагнал нэмнэ. Тэр болтол XP-ээ цуглуулаарай!'
            }
            action={
              manager ? (
                <Button
                  title="Шагнал нэмэх"
                  onPress={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                />
              ) : undefined
            }
          />
        ) : (
          <View style={styles.list}>
            {rewards.data.map((r, i) => {
              const Icon = REWARD_ICONS[r.icon] ?? Gift;
              const missing = r.xpCost - r.availableXP;
              return (
                <Animated.View
                  key={r.id}
                  entering={FadeInDown.delay(Math.min(i, 6) * 40).duration(280)}
                >
                  <Card style={[styles.reward, !r.isActive && styles.inactive]}>
                    <View style={styles.rewardRow}>
                      <View style={styles.rewardIcon}>
                        <Icon size={24} color={colors.purple} />
                      </View>
                      <View style={styles.flex}>
                        <AppText variant="bodyStrong" numberOfLines={2}>
                          {r.title}
                        </AppText>
                        <AppText variant="label" color={colors.purpleText}>
                          {r.xpCost} XP
                        </AppText>
                      </View>
                      <View style={styles.redeem}>
                        <Button
                          title="Авах"
                          variant={r.canRedeem ? 'primary' : 'secondary'}
                          disabled={!r.canRedeem || redeem.isPending}
                          onPress={() => confirmRedeem(r)}
                        />
                      </View>
                    </View>
                    {!r.isActive || !r.canRedeem || manager ? (
                      <View style={styles.rewardFooter}>
                        <AppText variant="caption" color={colors.secondary} style={styles.flex}>
                          {!r.isActive
                            ? 'Идэвхгүй'
                            : !r.canRedeem
                              ? `Дахиад ${missing} XP цуглуулаарай`
                              : ''}
                        </AppText>
                        {manager ? (
                          <View style={styles.manage}>
                            <Pressable
                              onPress={() => {
                                setEditing(r);
                                setFormOpen(true);
                              }}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`${r.title} засах`}
                            >
                              <Pencil size={18} color={colors.secondary} />
                            </Pressable>
                            <Pressable
                              onPress={() => confirmDelete(r)}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`${r.title} устгах`}
                            >
                              <Trash2 size={18} color={colors.error} />
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </Card>
                </Animated.View>
              );
            })}
          </View>
        )
      ) : (
        <View style={styles.list}>
          {(manager ? all.isPending : mine.isPending) ? (
            <ListSkeleton rows={2} trailing={false} />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<Gift size={28} color={colors.primary} />}
              title="Хүсэлт алга"
              message="Шагнал сонгоод «Авах» дарахад хүсэлт энд харагдана."
            />
          ) : (
            <>
              {pending.length > 0 ? (
                <Section title={manager ? 'Шийдвэрлэх хүсэлтүүд' : 'Хүлээгдэж буй'} />
              ) : null}
              {pending.map((r) => (
                <RedemptionRow key={r.id} item={r} showRequester={manager} />
              ))}
              {toHandOver.length > 0 ? (
                <Section title={manager ? 'Олгох шагналууд' : 'Зөвшөөрсөн'} />
              ) : null}
              {toHandOver.map((r) => (
                <RedemptionRow key={r.id} item={r} showRequester={manager} />
              ))}
              {history.length > 0 ? <Section title="Түүх" /> : null}
              {history.map((r) => (
                <RedemptionRow key={r.id} item={r} showRequester={manager} />
              ))}
            </>
          )}
        </View>
      )}

      <RewardFormSheet reward={editing} visible={formOpen} onClose={() => setFormOpen(false)} />
    </Screen>
  );
}

function Section({ title }: { title: string }) {
  return (
    <AppText variant="heading" style={styles.section}>
      {title}
    </AppText>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balance: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balanceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  reward: { gap: spacing.xs },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rewardFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  inactive: { opacity: 0.6 },
  rewardIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.purpleSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manage: { flexDirection: 'row', gap: spacing.lg, paddingHorizontal: spacing.xs },
  redeem: { minWidth: 88 },
  section: { marginTop: spacing.xs },
});
