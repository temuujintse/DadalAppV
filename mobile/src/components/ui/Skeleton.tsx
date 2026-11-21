import { useEffect } from 'react';
import { DimensionValue, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useIsOnline } from '@/services/offline/connectivity';
import { colors, radius, spacing } from '@/theme';
import { LoadingState } from './StateViews';

/** Placeholder block that gently pulses (static under Reduce Motion). */
export function Skeleton({
  width = '100%',
  height = 14,
  rounded = radius.sm,
}: {
  width?: DimensionValue;
  height?: number;
  rounded?: number;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.set(0.7);
      return;
    }
    opacity.set(withRepeat(withTiming(0.45, { duration: 750 }), -1, true));
  }, [reduceMotion, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  return (
    <Animated.View
      style={[styles.block, { width, height, borderRadius: rounded }, style]}
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Shape of a habit / quest / reward row while its list loads. */
export function SkeletonRow({ trailing = true }: { trailing?: boolean }) {
  return (
    <View style={styles.row}>
      <Skeleton width={44} height={44} rounded={radius.md} />
      <View style={styles.lines}>
        <Skeleton width="65%" height={16} />
        <Skeleton width="40%" height={12} />
      </View>
      {trailing ? <Skeleton width={44} height={44} rounded={22} /> : null}
    </View>
  );
}

/**
 * Loading placeholder for a list. Offline there is nothing to wait for, so it says so instead
 * of pulsing forever (queries pause while offline).
 */
export function ListSkeleton({ rows = 3, trailing }: { rows?: number; trailing?: boolean }) {
  const online = useIsOnline();
  if (!online) return <LoadingState />;
  return (
    <View
      style={styles.list}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Ачаалж байна…"
    >
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} trailing={trailing} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: colors.border },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  lines: { flex: 1, gap: spacing.xs },
  list: { gap: spacing.sm },
});
