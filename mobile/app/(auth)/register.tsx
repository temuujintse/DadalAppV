import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, TextInputInstance, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useRegister } from '@/features/auth/api';
import { RegisterForm, registerSchema } from '@/features/auth/schemas';
import { ApiError, errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';
import { applyServerFieldErrors } from '@/utils/form-errors';

const FIELDS = ['displayName', 'email', 'password'] as const;

export default function RegisterScreen() {
  const register = useRegister();
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const { control, handleSubmit, formState, setError } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit((values) =>
    register.mutate(values, {
      onError: (err) => applyServerFieldErrors(err, setError, FIELDS),
    }),
  );

  // Field-level server errors are shown under the inputs; everything else as a banner.
  const requestError =
    register.isError &&
    !(register.error instanceof ApiError && register.error.code === 'VALIDATION_ERROR')
      ? errorMessage(register.error)
      : null;

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={<Button title="Бүртгэл үүсгэх" onPress={onSubmit} loading={register.isPending} />}
    >
      <BackHeader />
      <View style={styles.header}>
        <AppText variant="title">Шинэ бүртгэл</AppText>
        <AppText color={colors.secondary}>
          Нэр, имэйлээ оруулаад гэр бүлийнхэнтэйгээ хамт эхлээрэй.
        </AppText>
      </View>

      <FormError message={requestError} />

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Таны нэр"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.displayName?.message}
            autoComplete="name"
            textContentType="nickname"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
            placeholder="Жишээ нь: Сараа"
            maxLength={50}
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            ref={emailRef}
            label="Имэйл"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.email?.message}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="name@example.com"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            ref={passwordRef}
            label="Нууц үг"
            secure
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.password?.message}
            hint="Дор хаяж 8 тэмдэгт, үсэг болон тоо орсон байна."
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />
        )}
      />

      <View style={styles.switchRow}>
        <AppText color={colors.secondary}>Бүртгэлтэй юу?</AppText>
        <Link href="/login" replace>
          <AppText variant="bodyStrong" color={colors.primaryText}>
            Нэвтрэх
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  switchRow: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
});
