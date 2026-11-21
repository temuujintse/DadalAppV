import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Ellipse } from 'react-native-svg';
import type { PetSpecies } from '@/types/api';
import {
  Background,
  Body,
  BodyAccessory,
  expressionFor,
  Eyes,
  FaceAccessory,
  Head,
  HeadAccessory,
  Mouth,
  NeckAccessory,
  PALETTES,
  Tail,
} from '../animation/art';
import type { PetAnimationState } from '../animation/pet-animation';
import { PetParticles } from './PetParticles';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export interface AnimatedPetProps {
  species: PetSpecies;
  state: PetAnimationState;
  /** assetKeys of equipped accessories */
  accessories?: string[];
  size?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
}

const VIEWBOX = '0 0 200 200';
/** Repeat forever, reversing each time (ping-pong). */
const loop = (anim: number) => withRepeat(anim, -1, true);

/**
 * Code-driven animated pet (react-native-svg + Reanimated, runs in Expo Go).
 * Every visual reaction is a function of `state` only — business logic never touches it.
 * Under Reduce Motion the pet still changes expression, but nothing moves.
 */
export function AnimatedPet({
  species,
  state,
  accessories = [],
  size = 200,
  onPress,
  accessibilityLabel,
}: AnimatedPetProps) {
  const reduceMotion = useReduceMotion();
  const p = PALETTES[species] ?? PALETTES.FOX;
  const expr = expressionFor(state);

  const bodyY = useSharedValue(0);
  const bodyScale = useSharedValue(1);
  const bodyRotate = useSharedValue(0);
  const breathe = useSharedValue(1);
  const headTilt = useSharedValue(0);
  const tail = useSharedValue(0);
  const blink = useSharedValue(1);
  const chew = useSharedValue(1);

  useEffect(() => {
    const all = [bodyY, bodyScale, bodyRotate, breathe, headTilt, tail, blink, chew];
    all.forEach((v) => cancelAnimation(v));
    bodyY.set(0);
    bodyScale.set(1);
    bodyRotate.set(0);
    breathe.set(1);
    blink.set(1);
    chew.set(1);
    headTilt.set(state === 'SAD' ? -6 : 0);
    tail.set(state === 'SAD' ? 10 : 0);
    if (reduceMotion) return;

    const ease = Easing.inOut(Easing.quad);
    const t = (to: number, duration: number) => withTiming(to, { duration, easing: ease });
    const jump = (h: number, times: number) =>
      withRepeat(
        withSequence(t(-h, 180), withSpring(0, { damping: 9, stiffness: 260 })),
        times,
        false,
      );

    switch (state) {
      case 'IDLE':
        breathe.set(loop(t(1.025, 1400)));
        tail.set(withSequence(t(-8, 600), loop(t(8, 1200))));
        headTilt.set(withSequence(t(-2, 1500), loop(t(2, 3000))));
        blink.set(withRepeat(withSequence(withDelay(3200, t(0.1, 90)), t(1, 110)), -1, false));
        break;
      case 'HAPPY':
        bodyY.set(jump(18, 2));
        tail.set(withSequence(t(-18, 120), loop(t(18, 240))));
        break;
      case 'CELEBRATE':
        bodyY.set(jump(26, 3));
        bodyRotate.set(withSequence(t(-6, 150), withRepeat(t(6, 300), 4, true), t(0, 150)));
        tail.set(withSequence(t(-20, 100), loop(t(20, 200))));
        break;
      case 'LEVEL_UP':
        bodyScale.set(withSequence(t(1.12, 260), withSpring(1, { damping: 7 })));
        bodyY.set(withSequence(withDelay(200, jump(30, 1))));
        tail.set(withSequence(t(-20, 100), loop(t(20, 200))));
        break;
      case 'UNLOCK':
        bodyScale.set(withSequence(t(0.92, 140), withSpring(1.06, { damping: 6 }), t(1, 300)));
        tail.set(withSequence(t(-14, 150), loop(t(14, 300))));
        break;
      case 'EATING':
        chew.set(loop(t(0.35, 220)));
        headTilt.set(loop(t(4, 440)));
        tail.set(withSequence(t(-10, 300), loop(t(10, 600))));
        break;
      case 'CARE':
        headTilt.set(withSequence(t(10, 400), loop(t(4, 800))));
        breathe.set(loop(t(1.03, 700)));
        tail.set(withSequence(t(-12, 400), loop(t(12, 800))));
        break;
      case 'SLEEPING':
        breathe.set(loop(t(1.04, 2200)));
        break;
      case 'SAD':
        breathe.set(loop(t(1.015, 1800)));
        break;
    }
  }, [state, reduceMotion, bodyY, bodyScale, bodyRotate, breathe, headTilt, tail, blink, chew]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyY.get() * (size / 200) },
      { rotate: `${bodyRotate.get()}deg` },
      { scale: bodyScale.get() },
    ],
  }));
  const breatheStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: breathe.get() }] }));
  const headStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${headTilt.get()}deg` }] }));
  const tailStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${tail.get()}deg` }] }));
  const eyesStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: blink.get() }] }));
  const mouthStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: chew.get() }] }));
  const shadowStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 1 + bodyY.get() / 120 }],
    opacity: 1 + bodyY.get() / 80,
  }));

  const bg = accessories.find((a) => a.startsWith('bg_'));
  const layer = { width: size, height: size };
  const svg = (children: React.ReactNode) => (
    <Svg width={size} height={size} viewBox={VIEWBOX}>
      {children}
    </Svg>
  );

  const content = (
    <View style={layer}>
      {bg ? <View style={StyleSheet.absoluteFill}>{svg(<Background assetKey={bg} />)}</View> : null}
      <Animated.View style={[StyleSheet.absoluteFill, shadowStyle]}>
        {svg(<Ellipse cx={100} cy={184} rx={46} ry={7} fill="rgba(30,41,59,0.10)" />)}
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
        {/* breathing pivots at the paws */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.pivotFeet, breatheStyle]}>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pivotTail, tailStyle]}>
            {svg(<Tail p={p} />)}
          </Animated.View>
          <View style={StyleSheet.absoluteFill}>
            {svg(
              <>
                <Body p={p} />
                {accessories.map((a) => (
                  <BodyAccessory key={`b-${a}`} assetKey={a} />
                ))}
                {accessories.map((a) => (
                  <NeckAccessory key={`n-${a}`} assetKey={a} />
                ))}
              </>,
            )}
          </View>
          <Animated.View style={[StyleSheet.absoluteFill, styles.pivotNeck, headStyle]}>
            <View style={StyleSheet.absoluteFill}>{svg(<Head p={p} blush={expr.blush} />)}</View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.pivotEyes, eyesStyle]}>
              {svg(<Eyes p={p} style={expr.eyes} />)}
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, styles.pivotMouth, mouthStyle]}>
              {svg(<Mouth p={p} style={expr.mouth} />)}
            </Animated.View>
            <View style={StyleSheet.absoluteFill}>
              {svg(
                <>
                  {accessories.map((a) => (
                    <FaceAccessory key={`f-${a}`} assetKey={a} />
                  ))}
                  {accessories.map((a) => (
                    <HeadAccessory key={`h-${a}`} assetKey={a} />
                  ))}
                </>,
              )}
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <PetParticles state={state} size={size} reduceMotion={reduceMotion} />
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Pet-ээ илбэж баярлуулах"
    >
      {content}
    </Pressable>
  );
}

// Pivot points (in % of the 200×200 art box) for natural-looking rotations.
const styles = StyleSheet.create({
  pivotFeet: { transformOrigin: '50% 90%' },
  pivotTail: { transformOrigin: '63% 75%' },
  pivotNeck: { transformOrigin: '50% 58%' },
  pivotEyes: { transformOrigin: '50% 41%' },
  pivotMouth: { transformOrigin: '50% 53%' },
});
