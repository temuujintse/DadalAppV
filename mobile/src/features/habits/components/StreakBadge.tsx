import { StyleSheet, View } from 'react-native';
import { Flame } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { colors, spacing } from '@/theme';

/** Flame + day count. Neutral grey at 0 — never red or shaming. */
export function StreakBadge({ days, size = 'sm' }: { days: number; size?: 'sm' | 'lg' }) {
  const active = days > 0;
  const iconSize = size === 'lg' ? 22 : 15;
  return (
    <View
      style={styles.row}
      accessibilityLabel={active ? `${days} өдрийн streak` : 'Streak эхлээгүй'}
    >
      <Flame
        size={iconSize}
        color={active ? colors.warning : colors.secondary}
        fill={active ? colors.warning : 'transparent'}
      />
      <AppText
        variant={size === 'lg' ? 'heading' : 'caption'}
        color={active ? colors.text : colors.secondary}
      >
        {days}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
});
