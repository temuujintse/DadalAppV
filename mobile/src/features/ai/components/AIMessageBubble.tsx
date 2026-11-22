import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { colors, radius, spacing } from '@/theme';
import type { AIMessage } from '@/types/api';

export function AIMessageBubble({ message }: { message: AIMessage }) {
  const mine = message.role === 'USER';
  return (
    <View
      style={[styles.bubble, mine ? styles.mine : styles.coach]}
      accessible
      accessibilityLabel={`${mine ? 'Та' : 'AI зөвлөгч'}: ${message.content}`}
    >
      <AppText color={mine ? colors.white : colors.text}>{message.content}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '85%', borderRadius: radius.lg, padding: spacing.md },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.purpleText, borderBottomRightRadius: 6 },
  coach: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
});
