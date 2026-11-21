import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Check, Moon } from 'lucide-react-native';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { colors } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PARTICLES = 8;
const BURST_MS = 520;

/**
 * Round completion toggle (spec 6.5: "checkmark + particles").
 * - done: filled with the habit colour + check; turning done pops and bursts particles
 * - rest: not scheduled today (moon, disabled)
 * Only a change to done animates — mounting an already-done card stays still — and Reduce
 * Motion keeps just the colour change.
 */
export function CompleteButton({
  done,
  color,
  disabled,
  rest,
  busy,
  onPress,
  accessibilityLabel,
  size = 44,
}: {
  done: boolean;
  color: string;
  disabled?: boolean;
  rest?: boolean;
  busy?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  const fill = useSharedValue(done ? 1 : 0);
  const burst = useSharedValue(0);
  const wasDone = useRef(done);

  useEffect(() => {
    const turnedDone = done && !wasDone.current;
    wasDone.current = done;
    fill.set(withTiming(done ? 1 : 0, { duration: 180 }));
    if (!turnedDone || reduceMotion) return;
    scale.set(
      withSequence(
        withTiming(1.18, { duration: 110 }),
        withSpring(1, { damping: 9, stiffness: 220 }),
      ),
    );
    burst.set(0);
    burst.set(withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.cubic) }));
  }, [done, reduceMotion, fill, scale, burst]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.get() }],
    backgroundColor: fill.get() > 0.5 ? color : colors.surface,
    borderColor: fill.get() > 0.5 ? color : rest ? colors.border : `${color}88`,
  }));

  return (
    <View style={{ width: size, height: size }}>
      {reduceMotion ? null : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {Array.from({ length: PARTICLES }, (_, i) => (
            <Particle
              key={i}
              index={i}
              progress={burst}
              color={i % 2 ? color : colors.warning}
              distance={size * 0.95}
              center={size / 2}
            />
          ))}
        </View>
      )}
      <AnimatedPressable
        onPress={() => {
          if (!done) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        disabled={disabled || rest || busy}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: disabled || rest, busy }}
        accessibilityLabel={accessibilityLabel}
        style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }, animated]}
      >
        {busy && !done ? (
          <ActivityIndicator color={color} size="small" />
        ) : rest ? (
          <Moon size={size * 0.42} color={colors.secondary} />
        ) : done ? (
          <Check size={size * 0.5} color={colors.white} strokeWidth={3} />
        ) : null}
      </AnimatedPressable>
    </View>
  );
}

const DOT = 6;

function Particle({
  index,
  progress,
  color,
  distance,
  center,
}: {
  index: number;
  progress: SharedValue<number>;
  color: string;
  distance: number;
  center: number;
}) {
  const angle = (index / PARTICLES) * Math.PI * 2 - Math.PI / 2;
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const travel = distance * p;
    return {
      opacity: p === 0 || p === 1 ? 0 : 1 - p,
      transform: [
        { translateX: center - DOT / 2 + Math.cos(angle) * travel },
        { translateY: center - DOT / 2 + Math.sin(angle) * travel },
        { scale: 1.2 - p * 0.7 },
      ],
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  circle: { borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2 },
});
