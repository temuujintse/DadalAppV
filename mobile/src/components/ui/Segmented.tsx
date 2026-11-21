import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, motion, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

const PAD = spacing.xxs;
const GAP = spacing.xxs;

/**
 * Single-choice segmented control (radio group). The selection pill slides to the chosen
 * segment (instant under Reduce Motion) with a light selection haptic.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const itemWidth =
    trackWidth > 0 ? (trackWidth - PAD * 2 - GAP * (options.length - 1)) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    x.set(withTiming(index * (itemWidth + GAP), { duration: motion.stateChange }));
  }, [index, itemWidth, x]);

  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      style={styles.track}
      onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {itemWidth > 0 ? (
        <Animated.View style={[styles.pill, { width: itemWidth }, pill]} pointerEvents="none" />
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(o.value);
            }}
            disabled={o.disabled}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ selected, disabled: o.disabled }}
            style={[styles.item, o.disabled && styles.disabled]}
          >
            <AppText variant="label" color={selected ? colors.primaryText : colors.secondary}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: PAD,
    gap: GAP,
  },
  pill: {
    position: 'absolute',
    top: PAD,
    bottom: PAD,
    left: PAD,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  item: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  disabled: { opacity: 0.4 },
});
