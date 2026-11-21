import { Ref, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  TextInputInstance,
  TextInputProps,
  View,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors, fonts, radius, spacing } from '@/theme';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  secure?: boolean;
  ref?: Ref<TextInputInstance>;
}

export function TextField({
  label,
  error,
  hint,
  secure = false,
  style,
  onFocus,
  onBlur,
  ref,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secure);

  const borderColor = error ? colors.error : focused ? colors.primary : colors.border;

  return (
    <View style={styles.container}>
      <AppText variant="label" color={colors.text}>
        {label}
      </AppText>
      <View style={[styles.inputWrap, { borderColor }]}>
        <TextInput
          ref={ref}
          {...rest}
          accessibilityLabel={label}
          secureTextEntry={hidden}
          placeholderTextColor="#A3AEC0"
          maxFontSizeMultiplier={1.6}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Нууц үгийг харуулах' : 'Нууц үгийг нуух'}
          >
            {hidden ? (
              <Eye size={20} color={colors.secondary} />
            ) : (
              <EyeOff size={20} color={colors.secondary} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="caption" color={colors.errorText} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" color={colors.secondary}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.md,
    minHeight: 52,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});
