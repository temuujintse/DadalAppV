import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, TextInputInstance, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useLogin } from '@/features/auth/api';
import { LoginForm, loginSchema } from '@/features/auth/schemas';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ email?: string; reset?: string }>();
  const login = useLogin();
  const passwordRef = useRef<TextInputInstance>(null);
  const { control, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: params.email ?? '', password: '' },
  });
  const email = useWatch({ control, name: 'email' });

  const onSubmit = handleSubmit((values) => login.mutate(values));

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={<Button title="Нэвтрэх" onPress={onSubmit} loading={login.isPending} />}
    >
      <BackHeader />
      <View style={styles.header}>
        <AppText variant="title">Тавтай морил 👋</AppText>
        <AppText color={colors.secondary}>Бүртгэлтэй имэйл, нууц үгээрээ нэвтэрнэ үү.</AppText>
      </View>

      {params.reset === '1' && !login.isError ? (
        <View style={styles.success} accessibilityRole="alert">
          <AppText variant="label" color={colors.successText}>
            Нууц үг шинэчлэгдлээ. Шинэ нууц үгээрээ нэвтэрнэ үү.
          </AppText>
        </View>
      ) : null}

      <FormError message={login.isError ? errorMessage(login.error) : null} />

      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
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
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={() => void onSubmit()}
          />
        )}
      />

      <Link
        href={{ pathname: '/forgot-password', params: email ? { email } : {} }}
        style={styles.forgot}
      >
        <AppText variant="label" color={colors.primaryText}>
          Нууц үгээ мартсан уу?
        </AppText>
      </Link>

      <View style={styles.switchRow}>
        <AppText color={colors.secondary}>Бүртгэлгүй юу?</AppText>
        <Link href="/register" replace>
          <AppText variant="bodyStrong" color={colors.primaryText}>
            Бүртгүүлэх
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  switchRow: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  forgot: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
  success: {
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
