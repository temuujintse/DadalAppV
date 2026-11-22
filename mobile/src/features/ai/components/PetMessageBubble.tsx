import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { emitPetEvent, PetEvent } from '@/features/pets/animation/pet-animation';
import { colors, radius, spacing } from '@/theme';
import type { PetInteraction } from '@/types/api';

const PLAY: Partial<Record<PetInteraction['animation'], PetEvent>> = {
  CELEBRATE: 'USER_LEVEL_UP',
  LEVEL_UP: 'PET_LEVEL_UP',
  CARE: 'CARE_PET',
  HAPPY: 'HABIT_COMPLETED',
};

const ACTIONS: Partial<Record<PetInteraction['suggestedAction'], { label: string; route: string }>> = {
  VIEW_PROGRESS: { label: 'Ахицаа харах', route: '/progress' },
  COMPLETE_HABIT: { label: 'Дадлууд руу', route: '/habits' },
  VIEW_QUESTS: { label: 'Даалгаврууд', route: '/quests' },
};

/** Speech bubble above the pet; plays the matching animation once per message. */
export function PetMessageBubble({ interaction }: { interaction: PetInteraction }) {
  useEffect(() => {
    const e = PLAY[interaction.animation];
    if (e) emitPetEvent(e);
  }, [interaction.message, interaction.animation]);

  const action = ACTIONS[interaction.suggestedAction];
  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.bubble}>
        <AppText align="center">{interaction.message}</AppText>
        {action ? (
          <Button
            title={action.label}
            variant="ghost"
            onPress={() => router.push(action.route as Parameters<typeof router.push>[0])}
          />
        ) : null}
      </View>
      <View style={styles.tail} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    maxWidth: 320,
    gap: 2,
  },
  tail: {
    width: 14,
    height: 14,
    backgroundColor: colors.surface,
    transform: [{ rotate: '45deg' }],
    marginTop: -7,
  },
});
