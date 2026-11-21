import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ChevronRight, Heart } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { InlineError } from '@/components/ui/StateViews';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';
import { isSleepTime, moodText, usePetAnimationState } from '../animation/pet-animation';
import { usePet } from '../api';
import { AnimatedPet } from './AnimatedPet';

/** Home dashboard pet: always alive (idle loop), reacts to completions, opens the Pet screen. */
export function PetCard() {
  const pet = usePet();
  const state = usePetAnimationState();
  if (!pet.data) {
    if (pet.isError) {
      return <InlineError message={errorMessage(pet.error)} onRetry={() => void pet.refetch()} />;
    }
    // Same footprint as the real card so the dashboard does not jump when it arrives.
    return (
      <Card style={styles.card}>
        <Skeleton width={118} height={118} rounded={59} />
        <View style={styles.info}>
          <Skeleton width="50%" height={20} />
          <Skeleton width="70%" height={12} />
          <Skeleton height={8} />
          <Skeleton height={8} />
        </View>
      </Card>
    );
  }
  const p = pet.data;

  return (
    <PressableScale
      onPress={() => router.push('/pet')}
      accessibilityRole="button"
      accessibilityLabel={`${p.name}, ${p.level}-р түвшин. ${moodText(p.name, p.mood, isSleepTime())}`}
    >
      <Card style={styles.card}>
        <AnimatedPet
          species={p.species}
          state={state}
          accessories={p.equipped.map((e) => e.assetKey).filter((k) => !k.startsWith('bg_'))}
          size={118}
        />
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <AppText variant="heading" numberOfLines={1} style={styles.flex}>
              {p.name}
            </AppText>
            <ChevronRight size={20} color={colors.secondary} />
          </View>
          <AppText variant="caption" color={colors.secondary}>
            Pet {p.level}-р түвшин · {p.xpIntoLevel}/{p.xpForNextLevel} XP
          </AppText>
          <ProgressBar
            progress={p.xpIntoLevel / p.xpForNextLevel}
            height={8}
            accessibilityLabel={`Pet-ийн дараагийн түвшин хүртэл ${p.xpIntoLevel} / ${p.xpForNextLevel}`}
          />
          <View style={styles.happyRow}>
            <Heart size={14} color={colors.error} fill={colors.error} />
            <View style={styles.flex}>
              <ProgressBar
                progress={p.happiness / 100}
                height={8}
                color={colors.success}
                accessibilityLabel={`Аз жаргал ${p.happiness}%`}
              />
            </View>
          </View>
          <AppText variant="caption" color={colors.secondary} numberOfLines={2}>
            {moodText(p.name, p.mood, isSleepTime())}
          </AppText>
        </View>
      </Card>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  info: { flex: 1, gap: spacing.xxs + 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  happyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1 },
});
