import { StyleSheet, Switch, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { AppText } from '@/components/ui/AppText';
import { Card } from '@/components/ui/Card';
import { setMotionPreference, useMotionStore } from '@/store/motion.store';
import { colors, spacing } from '@/theme';

/** In-app Reduce Motion option (spec 6.5). The system setting always wins when it is on. */
export function MotionCard() {
  const system = useReducedMotion();
  const reduce = useMotionStore((s) => s.preference === 'reduce');
  const label = 'Хөдөлгөөн багасгах';

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.text}>
          <AppText variant="label">{label}</AppText>
          <AppText variant="caption" color={colors.secondary}>
            {system
              ? 'Төхөөрөмжийн "Reduce Motion" асаалттай тул хөдөлгөөн аль хэдийн багассан.'
              : 'Шилжилт, баярын эффект, pet-ийн хөдөлгөөнийг хамгийн бага болгоно.'}
          </AppText>
        </View>
        <Switch
          value={system || reduce}
          disabled={system}
          onValueChange={(on) => void setMotionPreference(on ? 'reduce' : 'system')}
          trackColor={{ true: colors.primary, false: colors.border }}
          accessibilityLabel={label}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: 2 },
});
