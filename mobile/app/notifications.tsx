import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Bell, CheckCircle2, Gift, Users, XCircle } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { useMarkAllRead, useMarkRead, useNotificationsInbox } from '@/features/notifications/api';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { AppNotification, NotificationType } from '@/types/api';
import { SafeAreaView } from 'react-native-safe-area-context';

const ICONS: Partial<Record<NotificationType, { Icon: LucideIcon; color: string }>> = {
  FAMILY_ACTIVITY: { Icon: Users, color: colors.primary },
  REWARD_REQUESTED: { Icon: Gift, color: colors.purple },
  REWARD_APPROVED: { Icon: CheckCircle2, color: colors.success },
  REWARD_REJECTED: { Icon: XCircle, color: colors.secondary },
};

/** "5 мин", "3 цаг", "2 өдөр" */
function ago(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return 'дөнгөж сая';
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} цаг`;
  return `${Math.floor(h / 24)} өдөр`;
}

export default function NotificationsScreen() {
  const inbox = useNotificationsInbox();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  useRefreshOnFocus([inbox.refetch]);

  const items = inbox.data ?? [];
  const hasUnread = items.some((n) => !n.readAt);

  const open = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate(n.id);
    const route = n.data?.route;
    if (typeof route === 'string' && route.startsWith('/')) {
      router.push(route as Parameters<typeof router.push>[0]);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <BackHeader title="Мэдэгдэл" />
        {hasUnread ? (
          <Button
            title="Бүгдийг уншсан"
            variant="ghost"
            onPress={() => markAll.mutate()}
            loading={markAll.isPending}
          />
        ) : null}
      </View>
      {inbox.isPending ? (
        <View style={styles.pad}>
          <ListSkeleton rows={4} trailing={false} />
        </View>
      ) : inbox.isError ? (
        <ErrorState message={errorMessage(inbox.error)} onRetry={() => void inbox.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell size={28} color={colors.primary} />}
          title="Мэдэгдэл алга"
          message="Гэр бүлийн үйл явдал, шагналын хариу энд харагдана."
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          refreshing={inbox.isRefetching}
          onRefresh={() => void inbox.refetch()}
          renderItem={({ item: n }) => {
            const meta = ICONS[n.type] ?? { Icon: Bell, color: colors.primary };
            return (
              <Pressable
                onPress={() => open(n)}
                accessibilityRole="button"
                accessibilityLabel={`${n.readAt ? '' : 'Шинэ. '}${n.title}. ${n.body}`}
                style={[styles.row, !n.readAt && styles.unread]}
              >
                <View style={[styles.icon, { backgroundColor: `${meta.color}1F` }]}>
                  <meta.Icon size={20} color={meta.color} />
                </View>
                <View style={styles.text}>
                  <View style={styles.titleRow}>
                    <AppText variant="label" style={styles.flex} numberOfLines={1}>
                      {n.title}
                    </AppText>
                    <AppText variant="caption" color={colors.secondary}>
                      {ago(n.createdAt)}
                    </AppText>
                  </View>
                  <AppText variant="caption" color={colors.text}>
                    {n.body}
                  </AppText>
                </View>
                {!n.readAt ? <View style={styles.dot} /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  pad: { padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  unread: { backgroundColor: colors.primarySoft },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
});
