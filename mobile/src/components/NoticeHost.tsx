import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudOff, Info } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { useNoticeStore } from '@/store/notice.store';
import { colors, radius, shadow, spacing } from '@/theme';

const NOTICE_MS = 2600;
/** Sits above the tab bar. */
const TAB_BAR_CLEARANCE = 64;

/** Snackbar for short status messages. Mounted once at the root. */
export function NoticeHost() {
  const notice = useNoticeStore((s) => s.notice);
  const clear = useNoticeStore((s) => s.clear);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(clear, NOTICE_MS);
    return () => clearTimeout(t);
  }, [notice, clear]);

  if (!notice) return null;
  const Icon = notice.tone === 'warning' ? CloudOff : Info;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
    >
      <Animated.View
        key={notice.id}
        entering={FadeInDown.duration(200)}
        exiting={FadeOutDown.duration(160)}
        style={styles.notice}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Icon size={18} color={colors.white} />
        <AppText variant="label" color={colors.white} style={styles.text}>
          {notice.text}
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxWidth: 420,
    ...shadow.card,
  },
  text: { flexShrink: 1 },
});
