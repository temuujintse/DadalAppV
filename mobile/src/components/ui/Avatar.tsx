import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { API_BASE_URL } from '@/services/api/config';
import { useSessionStore } from '@/store/session.store';
import { colors } from '@/theme';
import { AppText } from './AppText';

/** Preset avatars (keys mirror the backend allow-list). Emoji render natively → no image assets. */
export const USER_AVATARS = {
  fox: '🦊',
  bear: '🐻',
  cat: '🐱',
  dog: '🐶',
  panda: '🐼',
  rabbit: '🐰',
  owl: '🦉',
  penguin: '🐧',
  lion: '🦁',
  koala: '🐨',
  tiger: '🐯',
  frog: '🐸',
} as const;

export const FAMILY_AVATARS = {
  home: '🏠',
  ger: '⛺',
  mountain: '🏔️',
  tree: '🌳',
  sun: '☀️',
  star: '⭐',
  heart: '❤️',
  rocket: '🚀',
} as const;

export type UserAvatarKey = keyof typeof USER_AVATARS;
export type FamilyAvatarKey = keyof typeof FAMILY_AVATARS;

export function avatarEmoji(key: string, kind: 'user' | 'family' = 'user'): string {
  const map: Record<string, string> = kind === 'user' ? USER_AVATARS : FAMILY_AVATARS;
  return map[key] ?? (kind === 'user' ? '🙂' : '🏠');
}

/**
 * Round avatar: the uploaded photo when there is one (loaded with the session token — photos
 * are private to the family), otherwise the preset emoji. A failed load falls back to the emoji.
 */
export function Avatar({
  avatarKey,
  photoUrl,
  size = 48,
  kind = 'user',
  background = colors.primarySoft,
}: {
  avatarKey: string;
  photoUrl?: string | null;
  size?: number;
  kind?: 'user' | 'family';
  background?: string;
}) {
  const token = useSessionStore((s) => s.tokens?.accessToken);
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = Boolean(photoUrl && token && failed !== photoUrl);
  const circle = { width: size, height: size, borderRadius: size / 2, backgroundColor: background };

  return (
    <View
      style={[styles.circle, circle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {showPhoto ? (
        <Image
          source={{ uri: `${API_BASE_URL}${photoUrl}`, headers: { Authorization: `Bearer ${token}` } }}
          style={circle}
          onError={() => setFailed(photoUrl ?? null)}
        />
      ) : (
        <AppText style={{ fontSize: size * 0.52, lineHeight: size * 0.68 }} allowFontScaling={false}>
          {avatarEmoji(avatarKey, kind)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
