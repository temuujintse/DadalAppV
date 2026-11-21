import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Share2, Trash2 } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { BackHeader } from '@/components/ui/BackHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormError } from '@/components/ui/FormError';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { useCreateInvite, useFamily, useInvites, useRevokeInvite } from '@/features/family/api';
import { familyUi, ROLE_LABELS } from '@/features/family/roles';
import { errorMessage } from '@/services/api/errors';
import { colors, fonts, radius, spacing } from '@/theme';
import type { CreatedInvite, FamilyRole } from '@/types/api';
import { formatTimeLeft } from '@/utils/date';

const USE_OPTIONS = [1, 3, 5] as const;

export default function InviteScreen() {
  const family = useFamily();
  const myRole = family.data?.myRole ?? 'MEMBER';
  const allowed = familyUi.canInvite(myRole);
  const roles = familyUi.invitableRoles(myRole) as Exclude<FamilyRole, 'OWNER'>[];

  const invites = useInvites(allowed);
  const create = useCreateInvite();
  const revoke = useRevokeInvite();
  const [role, setRole] = useState<Exclude<FamilyRole, 'OWNER'>>('MEMBER');
  const [maxUses, setMaxUses] = useState<number>(1);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  const onCreate = () =>
    create.mutate(
      { role, maxUses },
      {
        onSuccess: (invite) => {
          setCreated(invite);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    );

  const onShare = (invite: CreatedInvite) =>
    void Share.share({
      message:
        `${family.data?.name ?? 'Манай гэр бүл'} — Family Habit-д нэгдээрэй! ` +
        `Аппаа нээгээд "Урилгын кодоор нэгдэх" хэсэгт энэ кодыг оруулаарай: ${invite.code} ` +
        `(${formatTimeLeft(invite.expiresAt)} хүчинтэй)`,
    });

  const confirmRevoke = (id: string) =>
    Alert.alert('Урилгыг цуцлах уу?', 'Энэ кодоор цаашид нэгдэх боломжгүй болно.', [
      { text: 'Болих', style: 'cancel' },
      {
        text: 'Цуцлах',
        style: 'destructive',
        onPress: () =>
          revoke.mutate(id, { onError: (err) => Alert.alert('Амжилтгүй', errorMessage(err)) }),
      },
    ]);

  return (
    <Screen edges={['top', 'bottom', 'left', 'right']}>
      <BackHeader title="Гишүүн урих" variant="close" />

      {!allowed ? (
        <AppText color={colors.secondary} align="center">
          Гишүүн урих эрх зөвхөн эзэмшигч болон эцэг эхэд байна.
        </AppText>
      ) : created ? (
        <Animated.View entering={ZoomIn.duration(220)}>
          <Card style={styles.codeCard}>
            <AppText variant="caption" color={colors.secondary}>
              {ROLE_LABELS[created.role]} эрхтэй урилгын код
            </AppText>
            <AppText
              style={styles.code}
              selectable
              accessibilityLabel={`Урилгын код ${created.code.split('').join(' ')}`}
            >
              {created.code}
            </AppText>
            <AppText variant="caption" color={colors.secondary} align="center">
              {formatTimeLeft(created.expiresAt)} хүчинтэй · {created.maxUses} удаа ашиглана. Энэ
              кодыг зөвхөн одоо харуулна.
            </AppText>
            <Button
              title="Хуваалцах"
              icon={<Share2 size={18} color={colors.white} />}
              onPress={() => onShare(created)}
            />
            <Button title="Шинэ код үүсгэх" variant="ghost" onPress={() => setCreated(null)} />
          </Card>
        </Animated.View>
      ) : (
        <Card>
          <AppText variant="label">Ямар эрхтэйгээр урих вэ?</AppText>
          <ChipRow
            options={roles.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
            value={role}
            onChange={setRole}
          />
          <AppText variant="label">Хэдэн хүн ашиглах вэ?</AppText>
          <ChipRow
            options={USE_OPTIONS.map((n) => ({ value: n, label: `${n} хүн` }))}
            value={maxUses}
            onChange={setMaxUses}
          />
          <FormError message={create.isError ? errorMessage(create.error) : null} />
          <Button title="Урилгын код үүсгэх" onPress={onCreate} loading={create.isPending} />
        </Card>
      )}

      {allowed && invites.data && invites.data.length > 0 ? (
        <View style={styles.list}>
          <AppText variant="heading">Идэвхтэй урилгууд</AppText>
          {invites.data.map((inv) => (
            <View key={inv.id} style={styles.inviteRow}>
              <View style={styles.inviteText}>
                <AppText variant="bodyStrong">{ROLE_LABELS[inv.role]}</AppText>
                <AppText variant="caption" color={colors.secondary}>
                  {inv.usedCount}/{inv.maxUses} ашигласан · {formatTimeLeft(inv.expiresAt)} үлдсэн ·{' '}
                  {inv.createdByName}
                </AppText>
              </View>
              <Pressable
                onPress={() => confirmRevoke(inv.id)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Урилгыг цуцлах"
              >
                <Trash2 size={20} color={colors.error} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <PressableScale
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <AppText variant="label" color={selected ? colors.primaryText : colors.text}>
              {o.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  codeCard: { alignItems: 'stretch', gap: spacing.sm },
  code: {
    fontFamily: fonts.extrabold,
    fontSize: 34,
    lineHeight: 44,
    letterSpacing: 3,
    textAlign: 'center',
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  list: { gap: spacing.xs },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  inviteText: { flex: 1, gap: 2 },
});
