import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quest';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  accessibilityHint?: string;
  testID?: string;
}

const VARIANTS: Record<Variant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.primary, fg: colors.white },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  ghost: { bg: 'transparent', fg: colors.primaryText },
  danger: { bg: colors.errorSoft, fg: colors.errorText },
  /** Quest & special-reward accent (brand Accent with dark text for contrast). */
  quest: { bg: colors.accent, fg: colors.text },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const v = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <PressableScale
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        styles.base,
        { backgroundColor: v.bg, borderColor: v.border ?? v.bg, opacity: inactive ? 0.55 : 1 },
        variant === 'ghost' && styles.ghost,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <AppText variant="label" color={v.fg} style={styles.label}>
            {title}
          </AppText>
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: { minHeight: 44, borderWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { fontSize: 16 },
});
