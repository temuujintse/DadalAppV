import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { StyleSheet, Switch, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { AvatarPicker } from '@/components/ui/AvatarPicker';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { TextField } from '@/components/ui/TextField';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';
import type { Family } from '@/types/api';
import { useUpdateFamily } from '../api';
import { createFamilySchema } from '../schemas';

const editFamilySchema = createFamilySchema.extend({ leaderboardEnabled: z.boolean() });
type EditFamilyForm = z.infer<typeof editFamilySchema>;

export function EditFamilySheet({
  family,
  visible,
  onClose,
}: {
  family: Family;
  visible: boolean;
  onClose: () => void;
}) {
  const update = useUpdateFamily();
  const initial = {
    name: family.name,
    avatarKey: family.avatarKey,
    leaderboardEnabled: family.leaderboardEnabled,
  };
  const { control, handleSubmit, formState, reset } = useForm<EditFamilyForm>({
    resolver: zodResolver(editFamilySchema),
    defaultValues: initial,
  });

  useEffect(() => {
    if (visible) {
      reset(initial);
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when opening
  }, [visible]);

  const onSubmit = handleSubmit((values) => update.mutate(values, { onSuccess: onClose }));

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Гэр бүлийн тохиргоо">
      <FormError message={update.isError ? errorMessage(update.error) : null} />
      <Controller
        control={control}
        name="name"
        render={({ field }) => (
          <TextField
            label="Гэр бүлийн нэр"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.name?.message}
            maxLength={60}
          />
        )}
      />
      <View style={styles.section}>
        <AppText variant="label">Дүрс</AppText>
        <Controller
          control={control}
          name="avatarKey"
          render={({ field }) => (
            <AvatarPicker kind="family" value={field.value} onChange={field.onChange} />
          )}
        />
      </View>
      <View style={styles.switchRow}>
        <View style={styles.flex}>
          <AppText variant="label">Тэргүүлэгчдийн жагсаалт</AppText>
          <AppText variant="caption" color={colors.secondary}>
            Гишүүдийн XP-г хооронд нь харьцуулж харуулна. Хүүхдүүдэд дарамт болох бол унтраагаарай.
          </AppText>
        </View>
        <Controller
          control={control}
          name="leaderboardEnabled"
          render={({ field }) => (
            <Switch
              value={field.value}
              onValueChange={field.onChange}
              trackColor={{ true: colors.primary, false: colors.border }}
              accessibilityLabel="Тэргүүлэгчдийн жагсаалт харуулах"
            />
          )}
        />
      </View>
      <Button title="Хадгалах" onPress={onSubmit} loading={update.isPending} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
});
