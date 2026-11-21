import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { FAMILY_AVATARS, USER_AVATARS } from './Avatar';
import { PressableScale } from './PressableScale';

export function AvatarPicker({
  kind,
  value,
  onChange,
}: {
  kind: 'user' | 'family';
  value: string;
  onChange: (key: string) => void;
}) {
  const options = Object.entries(kind === 'user' ? USER_AVATARS : FAMILY_AVATARS);
  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {options.map(([key, emoji]) => {
        const selected = key === value;
        return (
          <PressableScale
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={key}
            style={[styles.cell, selected && styles.selected]}
          >
            <AppText style={styles.emoji} allowFontScaling={false}>
              {emoji}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  emoji: { fontSize: 28, lineHeight: 36 },
});
