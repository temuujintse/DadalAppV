import { Redirect } from 'expo-router';
import { useMe } from '@/features/auth/api';
import { useSessionStore } from '@/store/session.store';

/**
 * Entry hub for "/". When a Stack.Protected guard flips (login, logout, joining or leaving a
 * family) Expo Router falls back to this anchor, which forwards to the right place.
 */
export default function Index() {
  const signedIn = useSessionStore((s) => s.status === 'signedIn');
  const me = useMe();

  if (!signedIn) return <Redirect href="/welcome" />;
  if (!me.data) return null; // root layout shows loading/error until `me` is known
  return <Redirect href={me.data.family ? '/home' : '/family-setup'} />;
}
