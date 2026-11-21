import { StyleSheet, View } from 'react-native';
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

export function Avatar({
  avatarKey,
  size = 48,
  kind = 'user',
  background = colors.primarySoft,
}: {
  avatarKey: string;
  size?: number;
  kind?: 'user' | 'family';
  background?: string;
}) {
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: background },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText style={{ fontSize: size * 0.52, lineHeight: size * 0.68 }} allowFontScaling={false}>
        {avatarEmoji(avatarKey, kind)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
});
