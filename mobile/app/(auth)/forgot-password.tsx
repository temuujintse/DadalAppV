import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { useForgotPassword } from '@/features/auth/api';
import { ForgotForm, forgotSchema } from '@/features/auth/schemas';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';

/** Step 1 of password reset: e-mail a 6-digit code. */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const forgot = useForgotPassword();
  const { control, handleSubmit, formState } = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: params.email ?? '' },
  });

  const onSubmit = handleSubmit(({ email }) =>
    forgot.mutate(email, {
      // The server answers the same for unknown e-mails, so always continue.
      onSuccess: () => router.push({ pathname: '/reset-password', params: { email } }),
    }),
  );

  return (
    <Screen
      edges={['top', 'bottom', 'left', 'right']}
      footer={<Button title="Код авах" onPress={onSubmit} loading={forgot.isPending} />}
    >
      <BackHeader />
      <View style={styles.header}>
        <AppText variant="title">Нууц үг сэргээх</AppText>
        <AppText color={colors.secondary}>
          Бүртгэлтэй имэйлээ оруулна уу. Бид 6 оронтой код илгээнэ.
        </AppText>
      </View>

      <FormError message={forgot.isError ? errorMessage(forgot.error) : null} />

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
            returnKeyType="send"
            onSubmitEditing={() => void onSubmit()}
            placeholder="name@example.com"
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
});
