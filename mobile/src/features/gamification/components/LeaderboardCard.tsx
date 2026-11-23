import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { EyeOff, Trophy } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Segmented } from '@/components/ui/Segmented';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { InlineError } from '@/components/ui/StateViews';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { LeaderboardPeriod } from '@/types/api';
import { useLeaderboard } from '../api';

const MEDALS = ['🥇', '🥈', '🥉'];

/** In-family leaderboard. Shows a gentle note (not a ranking) when the family turned it off. */
export function LeaderboardCard() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('week');
  const board = useLeaderboard(period);

  return (
    <Card>
      <View style={styles.header}>
        <Trophy size={20} color={colors.primary} />
        <AppText variant="heading">Тэргүүлэгчид</AppText>
      </View>
      {board.data?.enabled === false ? null : (
        <Segmented
          accessibilityLabel="Хугацаа"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'week', label: '7 хоног' },
            { value: 'month', label: 'Сар' },
            { value: 'all', label: 'Бүх цаг' },
          ]}
        />
      )}
      {board.isPending ? (
        <ListSkeleton rows={3} trailing={false} />
      ) : board.isError ? (
        <InlineError message={errorMessage(board.error)} onRetry={() => void board.refetch()} />
      ) : !board.data.enabled ? (
        <View style={styles.disabled}>
          <EyeOff size={18} color={colors.secondary} />
          <AppText variant="caption" color={colors.secondary} style={styles.flex}>
            Гэр бүлийн тохиргоогоор тэргүүлэгчдийн жагсаалтыг нуусан байна.
          </AppText>
        </View>
      ) : (
        board.data.entries.map((e) => (
          <View key={e.userId} style={[styles.row, e.isMe && styles.me]}>
            <AppText style={styles.rank} align="center">
              {e.rank <= 3 && e.xp > 0 ? MEDALS[e.rank - 1] : e.rank}
            </AppText>
            <Avatar avatarKey={e.avatarKey} photoUrl={e.photoUrl} size={36} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {e.displayName}
                {e.isMe ? ' (Та)' : ''}
              </AppText>
              <AppText variant="caption" color={colors.secondary}>
                {e.level}-р түвшин
              </AppText>
            </View>
            <AppText variant="label">{e.xp} XP</AppText>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.md,
  },
  me: { backgroundColor: colors.primarySoft },
  rank: { width: 28, fontSize: 18 },
  flex: { flex: 1 },
  disabled: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
