import { StyleSheet, View } from 'react-native';
import { radius } from '@/theme';
import { HABIT_ICONS } from '../icons';

/** Habit icon on a soft tint of the habit colour. */
export function HabitIcon({
  icon,
  color,
  size = 44,
}: {
  icon: string;
  color: string;
  size?: number;
}) {
  const Icon = HABIT_ICONS[icon] ?? HABIT_ICONS.sparkles;
  return (
    <View
      style={[styles.box, { width: size, height: size, backgroundColor: `${color}22` }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon size={size * 0.5} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
});
