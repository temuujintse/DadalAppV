import { StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { colors, radius, spacing } from '@/theme';
import type { FamilyRole } from '@/types/api';
import { ROLE_LABELS } from '../roles';

/** Neutral badge; only OWNER gets the accent so the list stays calm. */
export function RoleBadge({ role }: { role: FamilyRole }) {
  const owner = role === 'OWNER';
  return (
    <View style={[styles.badge, owner ? styles.owner : styles.neutral]}>
      <AppText variant="caption" color={owner ? colors.primaryText : colors.secondary}>
        {ROLE_LABELS[role]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  owner: { backgroundColor: colors.primarySoft },
  neutral: { backgroundColor: colors.surfaceMuted },
});
