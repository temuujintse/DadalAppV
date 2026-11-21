import { Text, TextProps } from 'react-native';
import { colors, typography, TypographyVariant } from '@/theme';

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
}

/** Variants that title a screen or section; screen readers can jump between them. */
const HEADER_VARIANTS = new Set<TypographyVariant>(['display', 'title', 'heading']);

/**
 * Text with design-system typography. Font scaling stays enabled (accessibility), capped at
 * 1.6×. Titles and section headings are announced as headers.
 */
export function AppText({
  variant = 'body',
  color = colors.text,
  align,
  style,
  maxFontSizeMultiplier = 1.6,
  accessibilityRole,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      accessibilityRole={accessibilityRole ?? (HEADER_VARIANTS.has(variant) ? 'header' : undefined)}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[typography[variant], { color }, align ? { textAlign: align } : null, style]}
    />
  );
}
