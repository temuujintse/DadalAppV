import { Alert, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { errorMessage } from '@/services/api/errors';
import { colors, spacing } from '@/theme';
import type { FamilyMember, FamilyRole } from '@/types/api';
import { useChangeRole, useRemoveMember, useTransferOwnership } from '../api';
import { familyUi, ROLE_LABELS } from '../roles';

const ASSIGNABLE: Exclude<FamilyRole, 'OWNER'>[] = ['PARENT', 'MEMBER', 'CHILD'];

/** Actions the caller may take on another member. Only permitted actions are rendered. */
export function MemberActionsSheet({
  member,
  myRole,
  onClose,
}: {
  member: FamilyMember | null;
  myRole: FamilyRole;
  onClose: () => void;
}) {
  const changeRole = useChangeRole();
  const transfer = useTransferOwnership();
  const remove = useRemoveMember();

  if (!member) return null;

  const showError = (err: unknown) => Alert.alert('Амжилтгүй', errorMessage(err));

  const confirmTransfer = () =>
    Alert.alert(
      'Эзэмшигчийн эрх шилжүүлэх үү?',
      `${member.displayName} гэр бүлийн эзэмшигч болж, та "Эцэг эх" эрхтэй болно.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Шилжүүлэх',
          onPress: () => transfer.mutate(member.id, { onSuccess: onClose, onError: showError }),
        },
      ],
    );

  const confirmRemove = () =>
    Alert.alert(
      'Гишүүнийг хасах уу?',
      `${member.displayName} гэр бүлээс хасагдана. Түүний өмнөх ахиц, түүх хадгалагдана.`,
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Хасах',
          style: 'destructive',
          onPress: () => remove.mutate(member.id, { onSuccess: onClose, onError: showError }),
        },
      ],
    );

  const canChange = familyUi.canChangeRole(myRole, member.role);
  const canTransfer = familyUi.canTransferTo(myRole, member.role);
  const canRemove = familyUi.canRemove(myRole, member.role);

  return (
    <BottomSheet visible onClose={onClose}>
      <View style={styles.header}>
        <Avatar avatarKey={member.avatarKey} photoUrl={member.photoUrl} size={56} />
        <AppText variant="heading">{member.displayName}</AppText>
        <AppText variant="caption" color={colors.secondary}>
          {ROLE_LABELS[member.role]}
        </AppText>
      </View>

      {canChange ? (
        <View style={styles.section}>
          <AppText variant="label">Эрх солих</AppText>
          <View style={styles.roles}>
            {ASSIGNABLE.map((role) => (
              <View key={role} style={styles.roleButton}>
                <Button
                  title={ROLE_LABELS[role]}
                  variant={member.role === role ? 'primary' : 'secondary'}
                  disabled={member.role === role}
                  loading={changeRole.isPending && changeRole.variables?.role === role}
                  onPress={() =>
                    changeRole.mutate(
                      { memberId: member.id, role },
                      { onSuccess: onClose, onError: showError },
                    )
                  }
                />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {canTransfer ? (
        <Button
          title="Эзэмшигчийн эрх шилжүүлэх"
          variant="secondary"
          loading={transfer.isPending}
          onPress={confirmTransfer}
        />
      ) : null}
      {canRemove ? (
        <Button
          title="Гэр бүлээс хасах"
          variant="danger"
          loading={remove.isPending}
          onPress={confirmRemove}
        />
      ) : null}
      {!canChange && !canTransfer && !canRemove ? (
        <AppText color={colors.secondary} align="center">
          Энэ гишүүнд хийх үйлдэл алга.
        </AppText>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.xxs },
  section: { gap: spacing.xs },
  roles: { flexDirection: 'row', gap: spacing.xs },
  roleButton: { flex: 1 },
});
