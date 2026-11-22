import { Stack } from 'expo-router';
import { colors } from '@/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

export const unstable_settings = { anchor: 'welcome' };

export default function AuthLayout() {
  const reduceMotion = useReduceMotion();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: reduceMotion ? 'none' : 'slide_from_right',
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}
