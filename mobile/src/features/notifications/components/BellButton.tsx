import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, spacing } from '@/theme';
import { useUnreadCount } from '../api';

/** Home header bell with an unread badge; opens the inbox. */
export function BellButton() {
  const unread = useUnreadCount().data ?? 0;
  return (
    <PressableScale
      onPress={() => router.push('/notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread ? `Мэдэгдэл, ${unread} шинэ` : 'Мэдэгдэл'}
      style={styles.button}
    >
      <Bell size={24} color={colors.text} />
      {unread > 0 ? (
        <View style={styles.badge}>
          <AppText variant="caption" color={colors.white} style={styles.badgeText}>
            {unread > 9 ? '9+' : unread}
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: spacing.xxs,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, lineHeight: 14 },
});
