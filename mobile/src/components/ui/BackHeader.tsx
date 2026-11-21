import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, X } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

/** Compact header for pushed screens and modals. */
export function BackHeader({
  title,
  variant = 'back',
  right,
}: {
  title?: string;
  variant?: 'back' | 'close';
  right?: ReactNode;
}) {
  const Icon = variant === 'back' ? ChevronLeft : X;
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : undefined)}
        style={styles.button}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={variant === 'back' ? 'Буцах' : 'Хаах'}
      >
        <Icon size={24} color={colors.text} />
      </Pressable>
      {title ? (
        <AppText variant="heading" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  button: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'center' },
  right: { width: 44, alignItems: 'flex-end' },
});
