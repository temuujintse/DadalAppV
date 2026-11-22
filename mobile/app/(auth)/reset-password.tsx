import { zodResolver } from '@hookform/resolvers/zod';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, StyleSheet, TextInputInstance, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useForgotPassword, useResetPassword } from '@/features/auth/api';
import { ResetForm, resetSchema } from '@/features/auth/schemas';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';

/** Step 2 of password reset: the e-mailed code + a new password. */
export default function ResetPasswordScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const reset = useResetPassword();
  const resend = useForgotPassword();
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const { control, handleSubmit, formState } = useForm<ResetForm>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', password: '', confirm: '' },
  });

  const onSubmit = handleSubmit(({ code, password }) =>
    reset.mutate(
      { email, code, password },
      {
        onSuccess: () => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.dismissTo({ pathname: '/login', params: { email, reset: '1' } });
        },
      },
    ),
  );

  const onResend = () =>
    resend.mutate(email, {
      onSuccess: () => Alert.alert('Шинэ код илгээлээ', `${email} хаягаа шалгана уу.`),
      onError: (err) => Alert.alert('Илгээж чадсангүй', errorMessage(err)),
    });

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={
        <Button title="Нууц үг шинэчлэх" onPress={onSubmit} loading={reset.isPending} />
      }
    >
      <BackHeader />
      <View style={styles.header}>
        <AppText variant="title">Кодоо оруулна уу</AppText>
        <AppText color={colors.secondary}>
          {email} хаяг руу бүртгэлтэй бол 6 оронтой код илгээсэн. Spam хавтсаа ч шалгаарай.
        </AppText>
      </View>

      <FormError message={reset.isError ? errorMessage(reset.error) : null} />

      <Controller
        control={control}
        name="code"
        render={({ field }) => (
          <TextField
            label="6 оронтой код"
            value={field.value}
            onChangeText={(t) => field.onChange(t.replace(/\D/g, '').slice(0, 6))}
            onBlur={field.onBlur}
            error={formState.errors.code?.message}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={6}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="123456"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            ref={passwordRef}
            label="Шинэ нууц үг"
            secure
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.password?.message}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
            hint="Дор хаяж 8 тэмдэгт, үсэг болон тоо."
          />
        )}
      />
      <Controller
        control={control}
        name="confirm"
        render={({ field }) => (
          <TextField
            ref={confirmRef}
            label="Шинэ нууц үгээ давтах"
            secure
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.confirm?.message}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />
        )}
      />

      <Pressable
        onPress={onResend}
        disabled={resend.isPending}
        accessibilityRole="button"
        style={styles.resend}
      >
        <AppText variant="label" color={colors.primaryText}>
          {resend.isPending ? 'Илгээж байна…' : 'Код ирсэнгүй юу? Дахин илгээх'}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  resend: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
});
