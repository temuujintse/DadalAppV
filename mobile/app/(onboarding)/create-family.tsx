import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { AvatarPicker } from '@/components/ui/AvatarPicker';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useCreateFamily } from '@/features/family/api';
import { CreateFamilyForm, createFamilySchema } from '@/features/family/schemas';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';

export default function CreateFamilyScreen() {
  const create = useCreateFamily();
  const { control, handleSubmit, formState } = useForm<CreateFamilyForm>({
    resolver: zodResolver(createFamilySchema),
    defaultValues: { name: '', avatarKey: 'ger' },
  });

  // On success the root navigator sees `me.family` and switches to the tabs automatically.
  const onSubmit = handleSubmit((values) =>
    create.mutate(values, {
      onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    }),
  );

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={<Button title="Гэр бүл үүсгэх" onPress={onSubmit} loading={create.isPending} />}
    >
      <BackHeader title="Шинэ гэр бүл" />
      <AppText color={colors.secondary}>
        Гэр бүлдээ нэр өгөөд дүрс сонгоорой. Дараа нь өөрчилж болно.
      </AppText>

      <FormError message={create.isError ? errorMessage(create.error) : null} />

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
            placeholder="Жишээ нь: Батынхан"
            maxLength={60}
            returnKeyType="done"
          />
        )}
      />

      <View style={styles.section}>
        <AppText variant="label">Гэр бүлийн дүрс</AppText>
        <Controller
          control={control}
          name="avatarKey"
          render={({ field }) => (
            <AvatarPicker kind="family" value={field.value} onChange={field.onChange} />
          )}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
