import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useJoinFamily } from '@/features/family/api';
import { formatInviteCode, JoinFamilyInput, joinFamilySchema } from '@/features/family/schemas';
import { errorMessage } from '@/services/api/errors';
import { colors, fonts } from '@/theme';

export default function JoinFamilyScreen() {
  const join = useJoinFamily();
  const { control, handleSubmit, formState } = useForm<JoinFamilyInput, unknown, { code: string }>({
    resolver: zodResolver(joinFamilySchema),
    defaultValues: { code: '' },
  });

  const onSubmit = handleSubmit(({ code }) =>
    join.mutate(code, {
      onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    }),
  );

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={<Button title="Нэгдэх" onPress={onSubmit} loading={join.isPending} />}
    >
      <BackHeader title="Гэр бүлд нэгдэх" />
      <AppText color={colors.secondary}>
        Гэр бүлийн эзэмшигч эсвэл эцэг эхээс урилгын код аваад доор оруулна уу.
      </AppText>

      <FormError message={join.isError ? errorMessage(join.error) : null} />

      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="Урилгын код"
            value={field.value}
            onChangeText={(text) => field.onChange(formatInviteCode(text))}
            onBlur={field.onBlur}
            error={formState.errors.code?.message}
            placeholder="XXXXX-XXXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={11}
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
            style={styles.code}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  code: { fontFamily: fonts.extrabold, fontSize: 22, letterSpacing: 2 },
});
