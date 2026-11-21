import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Apple, Bath, Gamepad2, Hand, Heart, Lock, LucideIcon, Pencil } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { ACCESSORY_EMOJI } from '@/features/pets/animation/art';
import {
  emitPetEvent,
  isSleepTime,
  moodText,
  usePetAnimationState,
} from '@/features/pets/animation/pet-animation';
import {
  useAccessories,
  useCare,
  usePet,
  usePetHistory,
  useQueuedCareTypes,
  useToggleAccessory,
} from '@/features/pets/api';
import { AnimatedPet } from '@/features/pets/components/AnimatedPet';
import { PetNameSheet } from '@/features/pets/components/PetNameSheet';
import { useNow } from '@/hooks/useNow';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { ApiError, errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Accessory, Pet, PetCareType } from '@/types/api';

const CARE: Record<PetCareType, { label: string; Icon: LucideIcon; color: string }> = {
  PET: { label: 'Илбэх', Icon: Hand, color: '#EC4899' },
  FEED: { label: 'Хооллох', Icon: Apple, color: '#22C55E' },
  PLAY: { label: 'Тоглох', Icon: Gamepad2, color: '#F97316' },
  BATH: { label: 'Угаах', Icon: Bath, color: '#3B82F6' },
};

/** Rarity label colours (text shades, ≥ 4.5:1 on white). */
const RARITY_COLOR = {
  COMMON: colors.secondary,
  RARE: '#1D4ED8',
  EPIC: colors.purpleText,
  LEGENDARY: '#B45309',
};

function timeLeft(iso: string, now: Date): string {
  // `now` refreshes every 15 s, so round (not ceil) to avoid showing one extra minute.
  const min = Math.max(1, Math.round((new Date(iso).getTime() - now.getTime()) / 60_000));
  if (min < 60) return `${min} мин`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} цаг ${m} мин` : `${h} цаг`;
}

export default function PetScreen() {
  const pet = usePet();
  const accessories = useAccessories();
  const history = usePetHistory();
  const state = usePetAnimationState();
  const [editing, setEditing] = useState(false);
  useRefreshOnFocus([pet.refetch, accessories.refetch, history.refetch]);

  // A lonely pet greets you with a short "missed you" expression — never a punishment.
  const greeted = useRef(false);
  useEffect(() => {
    if (pet.data && !greeted.current) {
      greeted.current = true;
      if (pet.data.mood === 'LONELY' && !isSleepTime()) emitPetEvent('MISSED_YOU');
    }
  }, [pet.data]);

  if (pet.isPending) return <LoadingState />;
  if (pet.isError) {
    return (
      <Screen>
        <BackHeader />
        <ErrorState message={errorMessage(pet.error)} onRetry={() => void pet.refetch()} />
      </Screen>
    );
  }
  const p = pet.data;
  const sleeping = isSleepTime() && state === 'SLEEPING';

  const refreshing = pet.isRefetching || accessories.isRefetching;
  const onRefresh = () => {
    void pet.refetch();
    void accessories.refetch();
    void history.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <BackHeader
        title={p.name}
        right={
          <Pressable
            onPress={() => setEditing(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Нэр ба дүр солих"
          >
            <Pencil size={20} color={colors.text} />
          </Pressable>
        }
      />

      <Animated.View entering={FadeInDown.duration(300)} style={styles.stage}>
        <AnimatedPet
          species={p.species}
          state={state}
          accessories={p.equipped.map((e) => e.assetKey)}
          size={250}
          onPress={() => emitPetEvent('TAPPED')}
          accessibilityLabel={`${p.name}. ${moodText(p.name, p.mood, sleeping)}`}
        />
        <AppText color={colors.secondary} align="center">
          {moodText(p.name, p.mood, sleeping)}
        </AppText>
      </Animated.View>

      <Card>
        <View style={styles.rowBetween}>
          <AppText variant="label">Pet {p.level}-р түвшин</AppText>
          <AppText variant="caption" color={colors.secondary}>
            {p.xpIntoLevel} / {p.xpForNextLevel} XP
          </AppText>
        </View>
        <ProgressBar
          progress={p.xpIntoLevel / p.xpForNextLevel}
          accessibilityLabel={`Pet-ийн дараагийн түвшин хүртэл ${p.xpIntoLevel} / ${p.xpForNextLevel} XP`}
        />
        <View style={styles.rowBetween}>
          <View style={styles.row}>
            <Heart size={16} color={colors.error} fill={colors.error} />
            <AppText variant="label">Аз жаргал</AppText>
          </View>
          <AppText variant="caption" color={colors.secondary}>
            {p.happiness}%
          </AppText>
        </View>
        <ProgressBar
          progress={p.happiness / 100}
          color={colors.success}
          accessibilityLabel={`Аз жаргал ${p.happiness}%`}
        />
      </Card>

      <CareActions pet={p} />

      <AccessoryCollection
        items={accessories.data}
        error={accessories.isError ? errorMessage(accessories.error) : null}
        onRetry={() => void accessories.refetch()}
        unlocked={p.accessoriesUnlocked}
        total={p.accessoriesTotal}
      />

      <AppText variant="heading">Түүх</AppText>
      {history.data && history.data.length > 0 ? (
        <Card style={styles.history}>
          {history.data.map((h, i) => (
            <View
              key={h.id}
              style={[styles.historyRow, i < history.data.length - 1 && styles.divider]}
            >
              <AppText style={styles.flex} numberOfLines={1}>
                {h.title}
              </AppText>
              <AppText variant="label" color={h.amount > 0 ? colors.successText : colors.secondary}>
                {h.amount > 0 ? '+' : ''}
                {h.amount} XP
              </AppText>
            </View>
          ))}
        </Card>
      ) : history.data ? (
        <AppText color={colors.secondary}>
          Дадлаа биелүүлж, pet-дээ анхаарал тавихад түүх энд бүртгэгдэнэ.
        </AppText>
      ) : null}

      <PetNameSheet pet={p} visible={editing} onClose={() => setEditing(false)} />
    </Screen>
  );
}

function CareActions({ pet }: { pet: Pet }) {
  const care = useCare();
  const queued = useQueuedCareTypes();
  const now = useNow(15_000);

  const onCare = (type: PetCareType) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    care.mutate(type, {
      onError: (err) => {
        const msg =
          err instanceof ApiError && err.code === 'CARE_COOLDOWN'
            ? `${pet.name} одоохондоо амарч байна. Түр хүлээгээрэй.`
            : errorMessage(err);
        Alert.alert('Түр хүлээгээрэй', msg);
      },
    });
  };

  return (
    <View style={styles.section}>
      <AppText variant="heading">Арчлах</AppText>
      <View style={styles.careGrid}>
        {pet.care.map((c) => {
          const meta = CARE[c.type];
          const isQueued = queued.includes(c.type);
          const waiting = isQueued || (c.availableAt && new Date(c.availableAt) > now);
          const busy = care.isPending && care.variables === c.type;
          return (
            <PressableScale
              key={c.type}
              onPress={() => onCare(c.type)}
              disabled={Boolean(waiting) || care.isPending}
              accessibilityRole="button"
              accessibilityLabel={`${meta.label}, ${c.xp} Pet XP`}
              accessibilityState={{ disabled: Boolean(waiting), busy }}
              style={[styles.careButton, waiting ? styles.careWaiting : null]}
            >
              <View style={[styles.careIcon, { backgroundColor: `${meta.color}1F` }]}>
                <meta.Icon size={22} color={waiting ? colors.secondary : meta.color} />
              </View>
              <AppText variant="label">{meta.label}</AppText>
              <AppText variant="caption" color={colors.secondary}>
                {isQueued ? 'Синк хүлээж байна' : waiting ? timeLeft(c.availableAt!, now) : `+${c.xp} XP`}
              </AppText>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function AccessoryCollection({
  items,
  error,
  onRetry,
  unlocked,
  total,
}: {
  items: Accessory[] | undefined;
  error: string | null;
  onRetry: () => void;
  unlocked: number;
  total: number;
}) {
  const toggle = useToggleAccessory();

  return (
    <View style={styles.section}>
      <View style={styles.rowBetween}>
        <AppText variant="heading">Чимэглэл</AppText>
        <AppText variant="caption" color={colors.secondary}>
          {unlocked} / {total}
        </AppText>
      </View>
      {error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : !items ? (
        <LoadingState />
      ) : (
        <View style={styles.accessoryGrid}>
          {items.map((a) => (
            <PressableScale
              key={a.id}
              disabled={!a.unlocked || toggle.isPending}
              onPress={() =>
                toggle.mutate(
                  { id: a.id, equip: !a.equipped },
                  { onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)) },
                )
              }
              accessibilityRole="button"
              accessibilityState={{ selected: a.equipped, disabled: !a.unlocked }}
              accessibilityLabel={`${a.name}. ${
                a.unlocked ? (a.equipped ? 'Өмссөн' : 'Өмсгөх') : `Түгжээтэй: ${a.requirement}`
              }`}
              style={[
                styles.accessory,
                a.equipped && styles.accessoryEquipped,
                !a.unlocked && styles.accessoryLocked,
              ]}
            >
              <View style={styles.accessoryEmoji}>
                <AppText style={styles.emoji} allowFontScaling={false}>
                  {ACCESSORY_EMOJI[a.assetKey] ?? '🎁'}
                </AppText>
                {!a.unlocked ? (
                  <View style={styles.lockBadge}>
                    <Lock size={12} color={colors.white} />
                  </View>
                ) : null}
              </View>
              <AppText variant="label" align="center" numberOfLines={2}>
                {a.name}
              </AppText>
              {a.unlocked ? (
                <AppText
                  variant="caption"
                  color={a.equipped ? colors.primaryText : RARITY_COLOR[a.rarity]}
                >
                  {a.equipped ? 'Өмссөн ✓' : 'Өмсгөх'}
                </AppText>
              ) : (
                <View style={styles.lockInfo}>
                  <ProgressBar progress={a.progress} height={5} color={colors.purple} />
                  <AppText
                    variant="caption"
                    color={colors.secondary}
                    align="center"
                    numberOfLines={2}
                  >
                    {a.requirement}
                  </AppText>
                </View>
              )}
            </PressableScale>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceMuted,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { gap: spacing.sm },
  careGrid: { flexDirection: 'row', gap: spacing.xs },
  careButton: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  careWaiting: { opacity: 0.6 },
  careIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  accessoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, rowGap: spacing.sm },
  accessory: {
    width: '31%',
    alignItems: 'center',
    gap: 2,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  accessoryEquipped: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  accessoryLocked: { opacity: 0.75 },
  accessoryEmoji: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 32, lineHeight: 40 },
  lockBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockInfo: { alignSelf: 'stretch', gap: 2 },
  history: { gap: 0, paddingVertical: spacing.xs },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  flex: { flex: 1 },
});
