import { StyleSheet, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

/** Inline banner for request-level errors (e.g. wrong password, network down). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <AlertCircle size={18} color={colors.error} />
      <AppText variant="caption" color={colors.errorText} style={styles.text}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  text: { flex: 1 },
});
