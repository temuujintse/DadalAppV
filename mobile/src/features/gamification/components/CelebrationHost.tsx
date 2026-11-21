import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOutUp,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Star, Target } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AnimatedPet } from '@/features/pets/components/AnimatedPet';
import { queryClient, queryKeys } from '@/services/query-client';
import { ModalCelebration, useCelebrationStore } from '@/store/celebration.store';
import type { Pet } from '@/types/api';
import { colors, radius, shadow, spacing } from '@/theme';
import { ACHIEVEMENT_ICONS } from '../icons';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const TOAST_MS = 1800;

/** Renders the XP toast and the level-up / achievement modal queue. Mounted once at the root. */
export function CelebrationHost() {
  return (
    <>
      <XpToastView />
      <CelebrationModal />
    </>
  );
}

function XpToastView() {
  const toast = useCelebrationStore((s) => s.toast);
  const clear = useCelebrationStore((s) => s.clearToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(clear, TOAST_MS);
    return () => clearTimeout(t);
  }, [toast, clear]);

  if (!toast) return null;
  return (
    <View pointerEvents="none" style={[styles.toastWrap, { top: insets.top + spacing.xs }]}>
      <Animated.View
        key={toast.id}
        entering={SlideInUp.springify().damping(16)}
        exiting={FadeOutUp.duration(200)}
        style={styles.toast}
        accessibilityLiveRegion="polite"
        accessibilityLabel={
          toast.personalXP > 0 ? `${toast.personalXP} XP авлаа` : `Pet ${toast.petXP} XP авлаа`
        }
      >
        <Sparkles size={18} color={colors.white} />
        {toast.personalXP > 0 ? (
          <AppText variant="label" color={colors.white}>
            +{toast.personalXP} XP
          </AppText>
        ) : null}
        {toast.familyXP > 0 ? (
          <AppText variant="caption" color={colors.white} style={styles.toastFamily}>
            · Гэр бүл +{toast.familyXP}
          </AppText>
        ) : null}
        {toast.petXP > 0 ? (
          <AppText
            variant={toast.personalXP > 0 ? 'caption' : 'label'}
            color={colors.white}
            style={toast.personalXP > 0 ? styles.toastFamily : undefined}
          >
            {toast.personalXP > 0 ? '· ' : '+'}
            {toast.personalXP > 0 ? `Pet +${toast.petXP}` : `${toast.petXP} Pet XP`}
          </AppText>
        ) : null}
      </Animated.View>
    </View>
  );
}

function CelebrationModal() {
  const current = useCelebrationStore((s) => s.queue[0] ?? null);
  const dismiss = useCelebrationStore((s) => s.dismiss);
  const reduceMotion = useReduceMotion();
  const spin = useSharedValue(0);

  useEffect(() => {
    if (!current) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (!reduceMotion) {
      spin.set(0);
      spin.set(withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1));
    }
  }, [current, reduceMotion, spin]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.get() * 360}deg` }],
  }));

  if (!current) return null;
  const view = describe(current);
  const Icon = view.Icon;
  const accent = view.accent;
  const pet = queryClient.getQueryData<Pet>(queryKeys.petMe);

  return (
    <Modal transparent visible animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View
          entering={ZoomIn.springify().damping(14)}
          style={styles.card}
          accessibilityViewIsModal
          accessibilityLiveRegion="assertive"
        >
          <View style={styles.badgeWrap}>
            <Animated.View style={[styles.ring, { borderColor: `${accent}55` }, ringStyle]}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.sparkle,
                    {
                      backgroundColor: accent,
                      transform: [{ rotate: `${i * 60}deg` }, { translateY: -62 }],
                    },
                  ]}
                />
              ))}
            </Animated.View>
            {view.showPet ? (
              <Animated.View entering={FadeIn.delay(100)} style={styles.petBadge}>
                <AnimatedPet
                  species={pet?.species ?? 'FOX'}
                  state={current.kind === 'accessory' ? 'UNLOCK' : 'LEVEL_UP'}
                  accessories={[
                    ...(pet?.equipped.map((e) => e.assetKey) ?? []).filter(
                      (k) => current.kind !== 'accessory' || !k.startsWith('bg_'),
                    ),
                    ...(current.kind === 'accessory' ? [current.accessory.assetKey] : []),
                  ]}
                  size={124}
                />
              </Animated.View>
            ) : (
              <Animated.View
                entering={FadeIn.delay(150)}
                style={[styles.badge, { backgroundColor: accent }]}
              >
                <Icon
                  size={44}
                  color={colors.white}
                  fill={view.fillIcon ? colors.white : 'transparent'}
                />
              </Animated.View>
            )}
          </View>
          <AppText variant="caption" color={accent} align="center">
            {view.title}
          </AppText>
          <AppText variant="title" align="center">
            {view.headline.replace('{pet}', pet?.name ?? 'Pet')}
          </AppText>
          <AppText color={colors.secondary} align="center">
            {view.body.replace('{pet}', pet?.name ?? 'Pet')}
          </AppText>
          <View style={styles.action}>
            {current.kind === 'questReady' ? (
              <>
                <Button
                  title="Шагнал авах"
                  onPress={() => {
                    dismiss();
                    router.navigate('/quests');
                  }}
                />
                <Button title="Дараа" variant="ghost" onPress={dismiss} />
              </>
            ) : (
              <Button title="Гайхалтай!" onPress={dismiss} />
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface ModalView {
  title: string;
  headline: string;
  body: string;
  accent: string;
  Icon: typeof Star;
  fillIcon: boolean;
  showPet: boolean;
}

const RARITY_LABEL = { COMMON: 'Энгийн', RARE: 'Ховор', EPIC: 'Онцгой', LEGENDARY: 'Домогт' };

function describe(c: ModalCelebration): ModalView {
  switch (c.kind) {
    case 'levelUp':
      return {
        title: c.scope === 'family' ? 'Гэр бүл түвшин ахилаа!' : 'Түвшин ахилаа!',
        headline: `${c.level}-р түвшин`,
        body:
          c.scope === 'family'
            ? 'Хамтдаа хийсэн бүх дадал үр дүнгээ өглөө. Баяр хүргэе!'
            : 'Өдөр бүрийн жижиг алхам чинь энд хүргэлээ. Үргэлжлүүлээрэй!',
        accent: colors.primary,
        Icon: Star,
        fillIcon: true,
        showPet: false,
      };
    case 'petLevelUp':
      return {
        title: 'Pet түвшин ахилаа!',
        headline: `{pet} ${c.level}-р түвшинд хүрлээ`,
        body: 'Чиний дадал бүр түүнийг өсгөж байна. Хамтдаа цааш!',
        accent: colors.primary,
        Icon: Star,
        fillIcon: true,
        showPet: true,
      };
    case 'achievement':
      return {
        title: 'Шинэ амжилт!',
        headline: c.achievement.title,
        body: `${c.achievement.description} +${c.achievement.xpReward} XP`,
        accent: colors.purple,
        Icon: ACHIEVEMENT_ICONS[c.achievement.icon] ?? Star,
        fillIcon: false,
        showPet: false,
      };
    case 'questReady':
      return {
        title: c.quest.scope === 'FAMILY' ? 'Гэр бүлийн даалгавар биеллээ!' : 'Даалгавар биеллээ!',
        headline: c.quest.title,
        body: 'Шагналаа «Даалгавар» хэсгээс аваарай.',
        accent: colors.purple,
        Icon: Target,
        fillIcon: false,
        showPet: false,
      };
    case 'accessory':
      return {
        title: `Шинэ чимэглэл нээгдлээ · ${RARITY_LABEL[c.accessory.rarity]}`,
        headline: c.accessory.name,
        body: 'Pet дэлгэцийн «Чимэглэл» хэсгээс өмсгөж үзээрэй!',
        accent: colors.purple,
        Icon: Sparkles,
        fillIcon: false,
        showPet: true,
      };
  }
}

const styles = StyleSheet.create({
  petBadge: { alignItems: 'center', justifyContent: 'center' },
  toastWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...shadow.card,
  },
  toastFamily: { opacity: 0.9 },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    alignItems: 'center',
  },
  badgeWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  ring: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: { alignSelf: 'stretch', marginTop: spacing.md, gap: spacing.xs },
});
