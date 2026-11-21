import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AlertTriangle, CloudOff, RefreshCw } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { probeServer, useIsOnline } from '@/services/offline/connectivity';
import { selectPendingCount, selectUnseenIssues, useOutboxStore } from '@/services/offline/outbox';
import { requestSync } from '@/services/offline/sync-engine';
import { colors, radius, spacing } from '@/theme';
import { SyncIssuesSheet } from './SyncIssuesSheet';

/**
 * One-line connection / sync status at the top of every screen. Hidden when everything is
 * online and synced.
 */
export function SyncBanner() {
  const online = useIsOnline();
  const pending = useOutboxStore(selectPendingCount);
  const unseen = useOutboxStore(selectUnseenIssues);
  const syncing = useOutboxStore((s) => s.syncing);
  const [open, setOpen] = useState(false);

  let content: { text: string; tone: 'warning' | 'error' | 'info'; onPress: () => void } | null =
    null;
  if (!online) {
    content = {
      text: pending
        ? `Офлайн горим · ${pending} үйлдэл синк хүлээж байна`
        : 'Офлайн горим · Тэмдэглэлүүд хадгалагдаж, дараа синк хийгдэнэ',
      tone: 'warning',
      onPress: () => void probeServer(),
    };
  } else if (unseen) {
    content = {
      text: `${unseen} үйлдэл синк хийгдсэнгүй · Харах`,
      tone: 'error',
      onPress: () => setOpen(true),
    };
  } else if (pending) {
    content = {
      text: syncing ? 'Синк хийж байна…' : `${pending} үйлдэл синк хүлээж байна`,
      tone: 'info',
      onPress: () => void requestSync(),
    };
  }

  const tone = content ? TONES[content.tone] : null;
  const Icon = content?.tone === 'warning' ? CloudOff : content?.tone === 'error' ? AlertTriangle : RefreshCw;

  return (
    <>
      {content && tone ? (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)}>
          <Pressable
            onPress={content.onPress}
            accessibilityRole="button"
            accessibilityLabel={content.text}
            accessibilityLiveRegion="polite"
            style={[styles.banner, { backgroundColor: tone.bg }]}
          >
            <Icon size={16} color={tone.fg} />
            <AppText variant="caption" color={tone.fg} style={styles.text} numberOfLines={2}>
              {content.text}
            </AppText>
          </Pressable>
        </Animated.View>
      ) : null}
      <SyncIssuesSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const TONES = {
  warning: { bg: colors.warningSoft, fg: colors.warningText },
  error: { bg: colors.errorSoft, fg: colors.errorText },
  info: { bg: colors.primarySoft, fg: colors.primaryText },
} as const;

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
  },
  text: { flex: 1 },
});
