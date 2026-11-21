import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NoticeHost } from '@/components/NoticeHost';
import { Button } from '@/components/ui/Button';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { useLogout, useMe } from '@/features/auth/api';
import { CelebrationHost } from '@/features/gamification/components/CelebrationHost';
import { useAppStateFocus } from '@/hooks/useAppStateFocus';
import { errorMessage } from '@/services/api/errors';
import { startOfflineEngine } from '@/services/offline';
import { probeServer } from '@/services/offline/connectivity';
import { queryClient } from '@/services/query-client';
import { loadMotionPreference, useMotionStore } from '@/store/motion.store';
import { useSessionStore } from '@/store/session.store';
import { colors, spacing } from '@/theme';
import { useReduceMotion } from '@/hooks/useReduceMotion';

/** "/" is the fallback whenever a protected group becomes unavailable. */
export const unstable_settings = { anchor: 'index' };

void SplashScreen.preventAutoHideAsync();

// Dev-only notice Reanimated prints whenever the in-app "Reduce motion" option is on (intended).
LogBox.ignoreLogs(['Reduced motion setting is overwritten']);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });
  const status = useSessionStore((s) => s.status);
  useAppStateFocus();

  useEffect(() => {
    const stop = startOfflineEngine();
    void loadMotionPreference();
    void useSessionStore.getState().bootstrap();
    return stop;
  }, []);

  // Font failure must not block the app: fall back to system fonts.
  const ready = (fontsLoaded || Boolean(fontError)) && status !== 'loading';

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="dark" />
          <MotionConfig />
          {ready ? <RootNavigator /> : null}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * The in-app "Reduce motion" option applies to every Reanimated animation, including layout
 * animations, exactly like the system setting would.
 */
function MotionConfig() {
  const reduce = useMotionStore((s) => s.preference === 'reduce');
  return reduce ? <ReducedMotionConfig mode={ReduceMotion.Always} /> : null;
}

/**
 * Route access is derived from server state:
 *   signed out            → (auth)
 *   signed in, no family  → (onboarding)
 *   signed in with family → (tabs) + modals
 */
function RootNavigator() {
  const signedIn = useSessionStore((s) => s.status === 'signedIn');
  const me = useMe();
  const logout = useLogout();
  const reduceMotion = useReduceMotion();

  // Offline with nothing cached yet: the request is paused, not failed.
  const offlineNoData = me.data === undefined && me.fetchStatus === 'paused';
  const settled = !signedIn || me.data !== undefined || me.isError || offlineNoData;
  useEffect(() => {
    if (settled) void SplashScreen.hideAsync();
  }, [settled]);

  if (signedIn && me.data === undefined) {
    if (offlineNoData) {
      return (
        <View style={styles.fallback}>
          <ErrorState
            message="Интернэт холболт алга. Анх ачааллахад холболт хэрэгтэй, дараа нь офлайн ажиллана."
            onRetry={() => void probeServer()}
          />
        </View>
      );
    }
    if (me.isError) {
      return (
        <View style={styles.fallback}>
          <ErrorState
            message={errorMessage(me.error)}
            onRetry={() => void me.refetch()}
            retrying={me.isFetching}
          />
          <View style={styles.fallbackAction}>
            <Button title="Гарах" variant="ghost" onPress={() => logout.mutate()} />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.fallback}>
        <LoadingState />
      </View>
    );
  }

  const hasFamily = Boolean(me.data?.family);

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: reduceMotion ? 'none' : 'slide_from_right',
        }}
      >
        {/* Always reachable: resolves "/" (and every guard flip) to the right group. */}
        <Stack.Screen name="index" />

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !hasFamily}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && hasFamily}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
          <Stack.Screen name="habit/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="habit/[id]/index" />
          <Stack.Screen name="habit/[id]/edit" options={{ presentation: 'modal' }} />
          <Stack.Screen name="progress" />
          <Stack.Screen name="pet" />
        </Stack.Protected>

        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        </Stack.Protected>
      </Stack>
      {signedIn ? <CelebrationHost /> : null}
      <NoticeHost />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fallback: { flex: 1, backgroundColor: colors.background },
  fallbackAction: { padding: spacing.lg },
});
