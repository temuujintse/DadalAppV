import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { AppText } from '@/components/ui/AppText';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { TextField } from '@/components/ui/TextField';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { Pet, PetSpecies } from '@/types/api';
import { useUpdatePet } from '../api';
import { AnimatedPet } from './AnimatedPet';

const SPECIES: { value: PetSpecies; label: string }[] = [
  { value: 'FOX', label: 'Улаан үнэг' },
  { value: 'SNOW_FOX', label: 'Цагаан үнэг' },
  { value: 'NIGHT_FOX', label: 'Шөнийн үнэг' },
];

const schema = z.object({
  name: z.string().trim().min(1, 'Нэр оруулна уу.').max(30, 'Нэр 30 тэмдэгтээс ихгүй.'),
  species: z.enum(['FOX', 'SNOW_FOX', 'NIGHT_FOX']),
});
type Form = z.infer<typeof schema>;

/** Rename the pet and choose its look. */
export function PetNameSheet({
  pet,
  visible,
  onClose,
}: {
  pet: Pet;
  visible: boolean;
  onClose: () => void;
}) {
  const update = useUpdatePet();
  const initial = { name: pet.name, species: pet.species };
  const { control, handleSubmit, formState, reset } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });

  useEffect(() => {
    if (visible) {
      reset(initial);
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Нэр ба дүр">
      <FormError message={update.isError ? errorMessage(update.error) : null} />
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="Pet-ийн нэр"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.name?.message}
            maxLength={30}
          />
        )}
      />
      <Controller
        control={control}
        name="species"
        render={({ field }) => (
          <View style={styles.row} accessibilityRole="radiogroup">
            {SPECIES.map((s) => {
              const selected = field.value === s.value;
              return (
                <PressableScale
                  key={s.value}
                  onPress={() => field.onChange(s.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={s.label}
                  style={[styles.option, selected && styles.selected]}
                >
                  <AnimatedPet species={s.value} state="IDLE" size={72} />
                  <AppText
                    variant="caption"
                    color={selected ? colors.primaryText : colors.secondary}
                  >
                    {s.label}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        )}
      />
      <Button
        title="Хадгалах"
        loading={update.isPending}
        onPress={handleSubmit((v) => update.mutate(v, { onSuccess: onClose }))}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
});
