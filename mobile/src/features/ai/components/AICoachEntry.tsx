import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { PressableScale } from '@/components/ui/PressableScale';
import { colors, radius, spacing } from '@/theme';
import { useAIStatus, usePendingRecommendations } from '../api';

/** Home entry to the AI coach; hidden while AI is unavailable for this user. */
export function AICoachEntry() {
  const status = useAIStatus();
  const pending = usePendingRecommendations();
  if (!status.data?.enabled) return null;
  const count = pending.data?.length ?? 0;
  return (
    <PressableScale
      onPress={() => router.push('/ai/coach')}
      accessibilityRole="button"
      accessibilityLabel="AI зөвлөгч"
      style={styles.card}
    >
      <View style={styles.icon}>
        <Sparkles size={22} color={colors.white} />
      </View>
      <View style={styles.text}>
        <AppText variant="bodyStrong">AI зөвлөгч</AppText>
        <AppText variant="caption" color={colors.secondary}>
          {count > 0 ? `${count} шинэ дадлын санал хүлээж байна` : 'Зорилгоо хэлээд дадлын санал аваарай'}
        </AppText>
      </View>
      <ChevronRight size={20} color={colors.secondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.purpleSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
