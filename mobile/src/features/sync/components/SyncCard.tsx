import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useIsOnline } from '@/services/offline/connectivity';
import { useOutboxStore } from '@/services/offline/outbox';
import { requestSync } from '@/services/offline/sync-engine';
import { colors, radius, spacing } from '@/theme';
import { formatClock } from '@/utils/date';
import { clearSyncIssues, useServerSyncStatus, useSyncIssues } from '../api';
import { IssueRow } from './SyncIssuesSheet';

const TYPE_LABEL = {
  HABIT_COMPLETION: 'Биелэлт',
  COMPLETION_UNDO: 'Буцаалт',
  PET_CARE: 'Pet арчилгаа',
} as const;

/** Profile section: connection, queue, last sync and the server's offline window. */
export function SyncCard() {
  const online = useIsOnline();
  const pending = useOutboxStore((s) => s.pending);
  const syncing = useOutboxStore((s) => s.syncing);
  const lastSyncAt = useOutboxStore((s) => s.lastSyncAt);
  const issues = useSyncIssues();
  const server = useServerSyncStatus();

  const window = server.data?.offlineWindowDays;
  const processed = server.data?.counts.PROCESSED ?? 0;

  return (
    <Card>
      <View style={styles.header}>
        <AppText variant="label">Синк</AppText>
        <View style={[styles.pill, { backgroundColor: online ? colors.successSoft : colors.warningSoft }]}>
          <View style={[styles.dot, { backgroundColor: online ? colors.success : colors.warning }]} />
          <AppText variant="caption" color={online ? colors.text : colors.warningText}>
            {online ? 'Онлайн' : 'Офлайн'}
          </AppText>
        </View>
      </View>

      <AppText color={colors.secondary}>
        Интернэтгүй үед дадал тэмдэглэх, pet арчлах боломжтой. XP нь сервер баталгаажуулсны
        дараа нэмэгдэнэ
        {window !== undefined ? `; өнгөрсөн ${window} хоногийн тэмдэглэгээг хүлээн авна.` : '.'}
      </AppText>

      <View style={styles.stats}>
        <Stat value={String(pending.length)} label="Хүлээгдэж буй" />
        <Stat value={lastSyncAt ? formatClock(lastSyncAt) : '—'} label="Сүүлд синк" />
        <Stat value={server.data ? String(processed) : '—'} label="Синк хийсэн" />
      </View>

      {pending.length ? (
        <View style={styles.queue}>
          {pending.slice(0, 5).map((op) => (
            <AppText key={op.operationId} variant="caption" color={colors.secondary} numberOfLines={1}>
              • {TYPE_LABEL[op.type]}: {op.label} · {formatClock(op.createdAt)}
              {op.attempts ? ` · ${op.attempts} удаа оролдсон` : ''}
            </AppText>
          ))}
          {pending.length > 5 ? (
            <AppText variant="caption" color={colors.secondary}>
              … бас {pending.length - 5}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <Button
        title={syncing ? 'Синк хийж байна…' : 'Одоо синк хийх'}
        variant="secondary"
        loading={syncing}
        disabled={!online}
        onPress={() => {
          void requestSync({ reconcile: true }).then(() => server.refetch());
        }}
      />

      {issues.length ? (
        <View style={styles.issues}>
          <AppText variant="label">Синк хийгдээгүй ({issues.length})</AppText>
          {issues.slice(0, 5).map((issue) => (
            <IssueRow key={issue.operationId} issue={issue} />
          ))}
          <Button title="Жагсаалтыг цэвэрлэх" variant="ghost" onPress={clearSyncIssues} />
        </View>
      ) : null}
    </Card>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <AppText variant="heading">{value}</AppText>
      <AppText variant="caption" color={colors.secondary} align="center">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stats: { flexDirection: 'row', gap: spacing.xs },
  stat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  queue: { gap: 2 },
  issues: { gap: spacing.xs },
});
