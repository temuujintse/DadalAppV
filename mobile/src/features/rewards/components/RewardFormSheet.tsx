import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { TextField } from '@/components/ui/TextField';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Reward } from '@/types/api';
import { useSaveReward } from '../api';
import { REWARD_ICONS, REWARD_IDEAS } from '../icons';

const schema = z.object({
  title: z.string().trim().min(1, 'Шагналын нэрээ оруулна уу.').max(80, 'Нэр 80 тэмдэгтээс ихгүй.'),
  description: z.string().trim().max(280, 'Тайлбар 280 тэмдэгтээс ихгүй.'),
  icon: z.string(),
  xpCost: z
    .string()
    .regex(/^\d+$/, 'Зөвхөн тоо оруулна уу.')
    .refine((v) => Number(v) >= 10 && Number(v) <= 100000, '10-аас 100 000 XP хооронд байна.'),
});
type Form = z.infer<typeof schema>;

const EMPTY: Form = { title: '', description: '', icon: 'gift', xpCost: '100' };

/** Create or edit a reward (OWNER/PARENT). */
export function RewardFormSheet({
  reward,
  visible,
  onClose,
}: {
  reward: Reward | null;
  visible: boolean;
  onClose: () => void;
}) {
  const save = useSaveReward();
  const { control, handleSubmit, formState, reset, setValue } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  useEffect(() => {
    if (!visible) return;
    reset(
      reward
        ? {
            title: reward.title,
            description: reward.description ?? '',
            icon: reward.icon,
            xpCost: String(reward.xpCost),
          }
        : EMPTY,
    );
    save.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening
  }, [visible]);

  const onSubmit = handleSubmit((v) =>
    save.mutate(
      {
        id: reward?.id,
        body: {
          title: v.title,
          description: reward ? v.description || null : v.description || undefined,
          icon: v.icon,
          xpCost: Number(v.xpCost),
        },
      },
      { onSuccess: onClose },
    ),
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={reward ? 'Шагнал засах' : 'Шинэ шагнал'}
    >
      <FormError message={save.isError ? errorMessage(save.error) : null} />
      {!reward ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ideas}
        >
          {REWARD_IDEAS.map((idea) => (
            <PressableScale
              key={idea.title}
              onPress={() => {
                setValue('title', idea.title, { shouldValidate: true });
                setValue('icon', idea.icon);
                setValue('xpCost', String(idea.xpCost), { shouldValidate: true });
              }}
              style={styles.idea}
              accessibilityRole="button"
              accessibilityLabel={`Санаа: ${idea.title}`}
            >
              <AppText variant="caption">{idea.title}</AppText>
            </PressableScale>
          ))}
        </ScrollView>
      ) : null}
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <TextField
            label="Шагналын нэр"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.title?.message}
            maxLength={80}
          />
        )}
      />
      <View style={styles.row}>
        <View style={styles.flex}>
          <Controller
            control={control}
            name="xpCost"
            render={({ field }) => (
              <TextField
                label="Үнэ (XP)"
                value={field.value}
                onChangeText={(t) => field.onChange(t.replace(/\D/g, ''))}
                onBlur={field.onBlur}
                error={formState.errors.xpCost?.message}
                keyboardType="number-pad"
                maxLength={6}
              />
            )}
          />
        </View>
      </View>
      <Controller
        control={control}
        name="icon"
        render={({ field }) => (
          <View style={styles.icons} accessibilityRole="radiogroup">
            {Object.entries(REWARD_ICONS).map(([key, Icon]) => {
              const selected = field.value === key;
              return (
                <PressableScale
                  key={key}
                  onPress={() => field.onChange(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={key}
                  style={[styles.iconCell, selected && styles.iconSelected]}
                >
                  <Icon size={20} color={selected ? colors.purple : colors.secondary} />
                </PressableScale>
              );
            })}
          </View>
        )}
      />
      <Button title="Хадгалах" onPress={onSubmit} loading={save.isPending} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  ideas: { gap: spacing.xs },
  idea: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.purpleSoft,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  iconCell: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  iconSelected: { borderColor: colors.purple, backgroundColor: colors.purpleSoft },
});
