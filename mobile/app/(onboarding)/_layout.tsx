import { Stack } from 'expo-router';
import { colors } from '@/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export const unstable_settings = { anchor: 'family-setup' };

export default function OnboardingLayout() {
  const reduceMotion = useReduceMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reduceMotion ? 'none' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="family-setup" />
      <Stack.Screen name="create-family" />
      <Stack.Screen name="join-family" />
    </Stack>
  );
}
