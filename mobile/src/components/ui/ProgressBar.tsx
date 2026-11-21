import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme';

/** Animated horizontal progress (0–1). Animation is skipped under Reduced Motion. */
export function ProgressBar({
  progress,
  color = colors.primary,
  height = 10,
  accessibilityLabel,
}: {
  progress: number;
  color?: string;
  height?: number;
  accessibilityLabel?: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));
  const value = useSharedValue(0);

  useEffect(() => {
    value.set(withTiming(clamped, { duration: 600, reduceMotion: ReduceMotion.System }));
  }, [clamped, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }, fillStyle]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surfaceMuted, overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
});
