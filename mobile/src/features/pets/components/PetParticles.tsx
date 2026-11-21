import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { PetAnimationState } from '../animation/pet-animation';

interface ParticleSpec {
  emoji: string;
  /** position in % of the stage */
  x: number;
  y: number;
  delay: number;
}

const SPECS: Partial<Record<PetAnimationState, ParticleSpec[]>> = {
  CARE: [
    { emoji: '❤️', x: 30, y: 30, delay: 0 },
    { emoji: '💕', x: 66, y: 22, delay: 350 },
    { emoji: '❤️', x: 50, y: 14, delay: 700 },
  ],
  EATING: [
    { emoji: '🍎', x: 60, y: 52, delay: 0 },
    { emoji: '✨', x: 40, y: 40, delay: 500 },
  ],
  HAPPY: [
    { emoji: '✨', x: 24, y: 28, delay: 0 },
    { emoji: '✨', x: 72, y: 30, delay: 250 },
  ],
  CELEBRATE: [
    { emoji: '🎉', x: 18, y: 26, delay: 0 },
    { emoji: '✨', x: 76, y: 20, delay: 200 },
    { emoji: '⭐', x: 48, y: 8, delay: 400 },
    { emoji: '✨', x: 30, y: 12, delay: 600 },
  ],
  LEVEL_UP: [
    { emoji: '⭐', x: 20, y: 22, delay: 0 },
    { emoji: '🌟', x: 74, y: 18, delay: 200 },
    { emoji: '⭐', x: 48, y: 4, delay: 400 },
  ],
  UNLOCK: [
    { emoji: '✨', x: 22, y: 20, delay: 0 },
    { emoji: '🎁', x: 72, y: 24, delay: 150 },
    { emoji: '✨', x: 50, y: 6, delay: 300 },
  ],
  SLEEPING: [
    { emoji: '💤', x: 66, y: 20, delay: 0 },
    { emoji: '💤', x: 74, y: 10, delay: 1200 },
  ],
};

/** Floating emoji particles for the current state (decorative, hidden from screen readers). */
export function PetParticles({
  state,
  size,
  reduceMotion,
}: {
  state: PetAnimationState;
  size: number;
  reduceMotion: boolean;
}) {
  const specs = SPECS[state] ?? [];
  if (specs.length === 0) return null;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {(reduceMotion ? specs.slice(0, 1) : specs).map((s, i) => (
        <Particle key={`${state}-${i}`} spec={s} size={size} still={reduceMotion} />
      ))}
    </View>
  );
}

function Particle({ spec, size, still }: { spec: ParticleSpec; size: number; still: boolean }) {
  const progress = useSharedValue(still ? 0.3 : 0);

  useEffect(() => {
    if (still) return;
    progress.set(
      withDelay(
        spec.delay,
        withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1, false),
      ),
    );
    return () => cancelAnimation(progress);
  }, [progress, spec.delay, still]);

  const style = useAnimatedStyle(() => ({
    opacity: still ? 1 : progress.get() < 0.15 ? progress.get() / 0.15 : 1 - progress.get(),
    transform: [
      { translateY: -progress.get() * size * 0.18 },
      { scale: 0.7 + progress.get() * 0.5 },
    ],
  }));

  return (
    <Animated.View style={[styles.particle, { left: `${spec.x}%`, top: `${spec.y}%` }, style]}>
      <Text style={{ fontSize: Math.max(14, size * 0.1) }} allowFontScaling={false}>
        {spec.emoji}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute' },
});
