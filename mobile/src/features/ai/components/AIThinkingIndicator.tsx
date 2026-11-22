import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors, radius, spacing } from '@/theme';

function Dot({ delay }: { delay: number }) {
  const reduce = useReduceMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.set(
      withDelay(
        delay,
        withRepeat(withSequence(withTiming(-4, { duration: 250 }), withTiming(0, { duration: 250 })), -1),
      ),
    );
  }, [delay, reduce, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** "AI is thinking" row (static dots under Reduce Motion). */
export function AIThinkingIndicator({ label = 'AI бодож байна…' }: { label?: string }) {
  return (
    <View style={styles.row} accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <View style={styles.dots}>
        <Dot delay={0} />
        <Dot delay={120} />
        <Dot delay={240} />
      </View>
      <AppText variant="caption" color={colors.purpleText}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.purple },
});
