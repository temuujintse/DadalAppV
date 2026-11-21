import { router } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Home, KeyRound } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { useLogout, useMe } from '@/features/auth/api';
import { colors, radius, shadow, spacing } from '@/theme';

export default function FamilySetupScreen() {
  const me = useMe();
  const logout = useLogout();
  const name = me.data?.profile.displayName ?? '';

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={
        <Button
          title="Өөр бүртгэлээр нэвтрэх"
          variant="ghost"
          loading={logout.isPending}
          onPress={() => logout.mutate()}
        />
      }
    >
      <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
        <AppText variant="title">Сайн байна уу, {name}!</AppText>
        <AppText color={colors.secondary}>
          Family Habit-д дадлаа гэр бүлээрээ хамт хэвшүүлнэ. Эхлээд гэр бүлээ тохируулъя.
        </AppText>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <Choice
          icon={<Home size={26} color={colors.primary} />}
          title="Шинэ гэр бүл үүсгэх"
          description="Та эзэмшигч болж, гишүүдээ урилгын кодоор урина."
          onPress={() => router.push('/create-family')}
        />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(180).duration(400)}>
        <Choice
          icon={<KeyRound size={26} color={colors.primary} />}
          title="Урилгын кодоор нэгдэх"
          description="Гэр бүлийн гишүүнээсээ авсан 10 оронтой кодоо оруулна."
          onPress={() => router.push('/join-family')}
        />
      </Animated.View>
    </Screen>
  );
}

function Choice({
  icon,
  title,
  description,
  onPress,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      style={styles.choice}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
    >
      <View style={styles.iconBubble}>{icon}</View>
      <View style={styles.choiceText}>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="caption" color={colors.secondary}>
          {description}
        </AppText>
      </View>
      <ChevronRight size={22} color={colors.secondary} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xl },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  iconBubble: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceText: { flex: 1, gap: 2 },
});
