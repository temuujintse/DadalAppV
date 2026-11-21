import { ScrollView, StyleSheet, View } from 'react-native';
import { AlertTriangle, Ban } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import type { SyncIssue } from '@/services/offline/logic';
import { colors, radius, spacing } from '@/theme';
import { formatClock } from '@/utils/date';
import { acknowledgeIssues, useSyncIssues } from '../api';

const STATUS = {
  CONFLICT: { label: 'Зөрчил', color: colors.warningText, bg: colors.warningSoft, Icon: AlertTriangle },
  REJECTED: { label: 'Татгалзсан', color: colors.errorText, bg: colors.errorSoft, Icon: Ban },
} as const;

export function IssueRow({ issue }: { issue: SyncIssue }) {
  const s = STATUS[issue.status];
  return (
    <View style={styles.row} accessible accessibilityLabel={`${issue.label}. ${issue.message}`}>
      <View style={[styles.icon, { backgroundColor: s.bg }]}>
        <s.Icon size={16} color={s.color} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <AppText variant="label" numberOfLines={1} style={styles.title}>
            {issue.label}
          </AppText>
          <AppText variant="caption" color={s.color}>
            {s.label}
          </AppText>
        </View>
        <AppText variant="caption" color={colors.text}>
          {issue.message}
        </AppText>
        <AppText variant="caption" color={colors.secondary}>
          Хийсэн: {formatClock(issue.createdAt)}
        </AppText>
      </View>
    </View>
  );
}

/** Explains why queued actions were not applied (the server's own message). */
export function SyncIssuesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const issues = useSyncIssues();
  const close = () => {
    acknowledgeIssues();
    onClose();
  };
  return (
    <BottomSheet visible={visible} onClose={close} title="Синк хийгдээгүй үйлдлүүд">
      <AppText color={colors.secondary} align="center">
        Офлайн үед хийсэн эдгээр үйлдлийг сервер хүлээж авсангүй. XP, streak өөрчлөгдөөгүй.
      </AppText>
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {issues.map((issue) => (
          <IssueRow key={issue.operationId} issue={issue} />
        ))}
      </ScrollView>
      <Button title="Ойлголоо" onPress={close} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: { maxHeight: 360 },
  listContent: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  title: { flex: 1 },
});
