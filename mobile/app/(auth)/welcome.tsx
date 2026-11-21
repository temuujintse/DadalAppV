import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { colors, radius, spacing } from '@/theme';

export default function WelcomeScreen() {
  return (
    <Screen
      scroll={false}
      edges={['top', 'bottom', 'left', 'right']}
      footer={
        <Animated.View entering={FadeInUp.delay(250).duration(400)} style={styles.actions}>
          <Button title="Бүртгүүлэх" onPress={() => router.push('/register')} />
          <Button title="Нэвтрэх" variant="secondary" onPress={() => router.push('/login')} />
        </Animated.View>
      }
    >
      <View style={styles.hero}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.badge}>
          <AppText style={styles.emoji} allowFontScaling={false}>
            🦊
          </AppText>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).duration(500)} style={styles.copy}>
          <AppText variant="display" align="center">
            Family Habit
          </AppText>
          <AppText variant="heading" color={colors.primaryText} align="center">
            Build better habits together.
          </AppText>
          <AppText color={colors.secondary} align="center">
            Өдөр бүр бага багаар ахиж, гэр бүлээрээ хамт зөв дадал хэвшүүлээрэй. Таны найз pet ахиц
            бүрт тань баярлана.
          </AppText>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  badge: {
    width: 140,
    height: 140,
    borderRadius: radius.xl * 2,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 76, lineHeight: 96 },
  copy: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  actions: { gap: spacing.sm },
});
