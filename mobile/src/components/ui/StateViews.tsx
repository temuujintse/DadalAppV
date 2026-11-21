import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { AlertCircle, CloudOff } from 'lucide-react-native';
import { useIsOnline } from '@/services/offline/connectivity';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';
import { Button } from './Button';

/**
 * Offline, queries pause instead of failing, so a spinner would never end for data that was
 * never cached. Say what it is waiting for instead.
 */
export function LoadingState({ label = 'Ачаалж байна…' }: { label?: string }) {
  const online = useIsOnline();
  if (!online) {
    const text = 'Офлайн байна. Холбогдмогц энд ачаална.';
    return (
      <View style={styles.center} accessibilityLabel={text}>
        <CloudOff size={28} color={colors.secondary} />
        <AppText variant="caption" color={colors.secondary} align="center">
          {text}
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size="large" color={colors.primary} />
      <AppText variant="caption" color={colors.secondary}>
        {label}
      </AppText>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retrying,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.iconBubble}>
        <CloudOff size={28} color={colors.error} />
      </View>
      <AppText variant="heading" align="center">
        Уучлаарай, асуудал гарлаа
      </AppText>
      <AppText color={colors.secondary} align="center">
        {message}
      </AppText>
      {onRetry ? (
        <View style={styles.action}>
          <Button title="Дахин оролдох" onPress={onRetry} loading={retrying} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

/** Compact error for one section of a screen (the rest of the screen keeps working). */
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.inline} accessibilityRole="alert">
      <AlertCircle size={20} color={colors.error} />
      <AppText variant="caption" color={colors.text} style={styles.inlineText}>
        {message}
      </AppText>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Дахин оролдох"
          style={styles.inlineAction}
        >
          <AppText variant="label" color={colors.errorText}>
            Дахин
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: ReactNode;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.center}>
      <View style={[styles.iconBubble, { backgroundColor: colors.primarySoft }]}>{icon}</View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText color={colors.secondary} align="center">
        {message}
      </AppText>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
  iconBubble: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  action: { alignSelf: 'stretch', marginTop: spacing.sm },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inlineText: { flex: 1 },
  inlineAction: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
});
