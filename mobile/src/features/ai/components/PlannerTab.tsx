import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { AlertTriangle, CalendarClock, CheckCircle2, Circle, RefreshCw } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormError } from '@/components/ui/FormError';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { InlineError } from '@/components/ui/StateViews';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { AIPlan } from '@/types/api';
import {
  newRequestKey,
  useConfirmPlan,
  useDayPlans,
  useGeneratePlan,
  useRegeneratePlan,
} from '../api';
import { AIThinkingIndicator } from './AIThinkingIndicator';

/** AI Smart Planner: today's open habits laid out in time; nothing is active until confirmed. */
export function PlannerTab() {
  const day = useDayPlans();
  const generate = useGeneratePlan();
  const confirm = useConfirmPlan();
  const regenerate = useRegeneratePlan();
  // Retrying after a lost response reuses the key, so no second AI call is made.
  const pendingKey = useRef<string | null>(null);

  const busy = generate.isPending || regenerate.isPending;
  const draft = day.data?.draft ?? null;
  const active = day.data?.active ?? null;
  const shown = draft ?? active;

  const create = () => {
    pendingKey.current ??= newRequestKey();
    generate.mutate(
      { idempotencyKey: pendingKey.current },
      { onSettled: () => (pendingKey.current = null) },
    );
  };

  const redo = (plan: AIPlan) => {
    pendingKey.current ??= newRequestKey();
    regenerate.mutate(
      { id: plan.id, idempotencyKey: pendingKey.current },
      { onSettled: () => (pendingKey.current = null) },
    );
  };

  const activate = (plan: AIPlan) =>
    Alert.alert(
      'Төлөвлөгөөг идэвхжүүлэх үү?',
      active ? 'Өнөөдрийн одоогийн төлөвлөгөөг энэ шинэ төлөвлөгөөгөөр солино.' : 'Өнөөдрийн хуваарь болгон хадгална.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Идэвхжүүлэх',
          onPress: () =>
            confirm.mutate(plan.id, {
              onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
              onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)),
            }),
        },
      ],
    );

  const error = generate.error ?? regenerate.error;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AppText color={colors.secondary}>
        AI өнөөдрийн үлдсэн дадлуудыг цаг хуваарьт оруулж санал болгоно. Та баталгаажуулсны дараа л
        идэвхжинэ.
      </AppText>

      {day.isPending ? (
        <ListSkeleton rows={2} trailing={false} />
      ) : day.isError ? (
        <InlineError message={errorMessage(day.error)} onRetry={() => void day.refetch()} />
      ) : null}

      {busy ? <AIThinkingIndicator label="Хуваарь гаргаж байна…" /> : null}
      <FormError message={error ? errorMessage(error) : null} />

      {shown ? (
        <PlanCard
          plan={shown}
          onConfirm={draft ? () => activate(draft) : undefined}
          confirming={confirm.isPending}
          onRegenerate={() => redo(shown)}
          regenerating={regenerate.isPending}
        />
      ) : !day.isPending && !day.isError ? (
        <Button
          title="Өнөөдрийн төлөвлөгөө гаргах"
          variant="quest"
          icon={<CalendarClock size={18} color={colors.text} />}
          onPress={create}
          loading={generate.isPending}
        />
      ) : null}

      {draft && active ? (
        <AppText variant="caption" color={colors.secondary} align="center">
          Идэвхтэй төлөвлөгөө хэвээр байгаа; шинэ ноорогийг идэвхжүүлбэл солигдоно.
        </AppText>
      ) : null}
    </ScrollView>
  );
}

function PlanCard({
  plan,
  onConfirm,
  confirming,
  onRegenerate,
  regenerating,
}: {
  plan: AIPlan;
  onConfirm?: () => void;
  confirming: boolean;
  onRegenerate: () => void;
  regenerating: boolean;
}) {
  const isActive = plan.status === 'ACTIVE';
  return (
    <Card>
      <View style={styles.head}>
        <AppText variant="heading" style={styles.flex}>
          {isActive ? 'Өнөөдрийн төлөвлөгөө' : 'Санал болгож буй хуваарь'}
        </AppText>
        <View style={[styles.badge, isActive ? styles.badgeActive : styles.badgeDraft]}>
          <AppText variant="caption" color={isActive ? colors.successText : colors.purpleText}>
            {isActive ? 'Идэвхтэй' : 'Ноорог'}
          </AppText>
        </View>
      </View>
      <AppText color={colors.secondary}>{plan.summary}</AppText>

      {plan.items.map((i) => (
        <View key={i.id} style={styles.item} accessible accessibilityLabel={`${i.startTime}, ${i.title}, ${i.durationMinutes} минут${i.completed ? ', биелсэн' : ''}`}>
          <AppText variant="label" style={styles.time}>
            {i.startTime}
          </AppText>
          <View style={styles.flex}>
            <AppText variant="bodyStrong" style={i.completed ? styles.done : undefined}>
              {i.title}
            </AppText>
            <AppText variant="caption" color={colors.secondary}>
              {i.durationMinutes} мин{i.note ? ` · ${i.note}` : ''}
            </AppText>
          </View>
          {i.completed ? (
            <CheckCircle2 size={20} color={colors.success} />
          ) : (
            <Circle size={20} color={colors.border} />
          )}
        </View>
      ))}

      <AppText variant="caption" color={colors.secondary}>
        Нийт {plan.totalMinutes} минут
      </AppText>

      {plan.warnings.map((w) => (
        <View key={w.code} style={styles.warning}>
          <AlertTriangle size={16} color={colors.warningText} />
          <AppText variant="caption" color={colors.warningText} style={styles.flex}>
            {w.message}
          </AppText>
        </View>
      ))}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title="Дахин гаргах"
            variant="secondary"
            icon={<RefreshCw size={16} color={colors.text} />}
            onPress={onRegenerate}
            loading={regenerating}
          />
        </View>
        {onConfirm ? (
          <View style={styles.flex}>
            <Button title="Идэвхжүүлэх" variant="quest" onPress={onConfirm} loading={confirming} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeActive: { backgroundColor: colors.successSoft },
  badgeDraft: { backgroundColor: colors.purpleSoft },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  time: { width: 48, color: colors.purpleText },
  done: { textDecorationLine: 'line-through', color: colors.secondary },
  warning: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
