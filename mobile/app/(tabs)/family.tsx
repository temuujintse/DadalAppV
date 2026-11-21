import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronRight, Pencil, UserPlus, Users } from 'lucide-react-native';
import { AppText } from '@/components/ui/AppText';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Screen } from '@/components/ui/Screen';
import { ListSkeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/StateViews';
import { useFamily, useMembers, useRemoveMember } from '@/features/family/api';
import { EditFamilySheet } from '@/features/family/components/EditFamilySheet';
import { MemberActionsSheet } from '@/features/family/components/MemberActionsSheet';
import { RoleBadge } from '@/features/family/components/RoleBadge';
import { familyUi } from '@/features/family/roles';
import { LeaderboardCard } from '@/features/gamification/components/LeaderboardCard';
import { levelProgress } from '@/features/gamification/level';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import { errorMessage } from '@/services/api/errors';
import { colors, radius, spacing } from '@/theme';
import type { FamilyMember } from '@/types/api';

export default function FamilyScreen() {
  const family = useFamily();
  const members = useMembers();
  const leave = useRemoveMember();
  useRefreshOnFocus([family.refetch, members.refetch]);
  const [selected, setSelected] = useState<FamilyMember | null>(null);
  const [editing, setEditing] = useState(false);

  if (family.isPending || family.isError) {
    return (
      <Screen>
        <AppText variant="title">Гэр бүл</AppText>
        {family.isPending ? (
          <ListSkeleton rows={3} trailing={false} />
        ) : (
          <ErrorState
            message={errorMessage(family.error)}
            onRetry={() => void family.refetch()}
            retrying={family.isFetching}
          />
        )}
      </Screen>
    );
  }

  const f = family.data;
  const myRole = f.myRole;
  const progress = levelProgress(f.gamification.level, f.gamification.lifetimeXP);
  // The member list is the freshest source; fall back to the family summary while it loads.
  const memberCount = members.data?.length ?? f.memberCount;
  const isLastMember = memberCount === 1;

  const confirmLeave = () =>
    Alert.alert(
      'Гэр бүлээс гарах уу?',
      isLastMember
        ? 'Та сүүлийн гишүүн тул гэр бүл хаагдана. Таны хувийн ахиц хадгалагдана.'
        : 'Дахин нэгдэхийн тулд шинэ урилгын код шаардлагатай. Таны хувийн ахиц хадгалагдана.',
      [
        { text: 'Болих', style: 'cancel' },
        {
          text: 'Гарах',
          style: 'destructive',
          onPress: () =>
            leave.mutate(f.myMemberId, {
              onError: (err) => Alert.alert('Гарах боломжгүй', errorMessage(err)),
            }),
        },
      ],
    );

  const refreshing = family.isRefetching || members.isRefetching;
  const onRefresh = () => {
    void family.refetch();
    void members.refetch();
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Animated.View entering={FadeInDown.duration(350)}>
        <Card style={styles.hero}>
          <Avatar avatarKey={f.avatarKey} kind="family" size={72} />
          <View style={styles.heroTitle}>
            <AppText variant="title" align="center" numberOfLines={2}>
              {f.name}
            </AppText>
            {familyUi.canEditFamily(myRole) ? (
              <Pressable
                onPress={() => setEditing(true)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Гэр бүлийн тохиргоо засах"
              >
                <Pencil size={18} color={colors.secondary} />
              </Pressable>
            ) : null}
          </View>
          <AppText variant="caption" color={colors.secondary}>
            Гэр бүлийн {f.gamification.level}-р түвшин · {f.gamification.lifetimeXP} XP
          </AppText>
          <ProgressBar
            progress={progress.ratio}
            accessibilityLabel={`Гэр бүлийн дараагийн түвшин хүртэл ${progress.current} / ${progress.needed} XP`}
          />
        </Card>
      </Animated.View>

      <View style={styles.sectionHeader}>
        <AppText variant="heading">Гишүүд ({memberCount})</AppText>
        {familyUi.canInvite(myRole) ? (
          <Button
            title="Урих"
            variant="ghost"
            icon={<UserPlus size={18} color={colors.primary} />}
            onPress={() => router.push('/invite')}
          />
        ) : null}
      </View>

      {members.isPending ? (
        <ListSkeleton rows={3} trailing={false} />
      ) : members.isError ? (
        <ErrorState
          message={errorMessage(members.error)}
          onRetry={() => void members.refetch()}
          retrying={members.isFetching}
        />
      ) : members.data.length <= 1 ? (
        <>
          {members.data.map((m) => (
            <MemberRow key={m.id} member={m} onPress={undefined} />
          ))}
          <EmptyState
            icon={<Users size={28} color={colors.primary} />}
            title="Одоохондоо ганцаараа байна"
            message={
              familyUi.canInvite(myRole)
                ? 'Гэр бүлийн гишүүдээ урилгын кодоор урьж, хамтдаа эхлээрэй.'
                : 'Эзэмшигч эсвэл эцэг эх шинэ гишүүдийг урина.'
            }
          />
        </>
      ) : (
        <View style={styles.list}>
          {members.data.map((m, i) => {
            const actionable =
              !m.isMe &&
              (familyUi.canChangeRole(myRole, m.role) || familyUi.canRemove(myRole, m.role));
            return (
              <Animated.View key={m.id} entering={FadeInDown.delay(40 * i).duration(300)}>
                <MemberRow member={m} onPress={actionable ? () => setSelected(m) : undefined} />
              </Animated.View>
            );
          })}
        </View>
      )}

      {memberCount > 1 ? <LeaderboardCard /> : null}

      <Button
        title="Гэр бүлээс гарах"
        variant="danger"
        loading={leave.isPending}
        onPress={confirmLeave}
      />

      <MemberActionsSheet member={selected} myRole={myRole} onClose={() => setSelected(null)} />
      <EditFamilySheet family={f} visible={editing} onClose={() => setEditing(false)} />
    </Screen>
  );
}

function MemberRow({ member, onPress }: { member: FamilyMember; onPress?: () => void }) {
  const content = (
    <>
      <Avatar avatarKey={member.avatarKey} size={44} />
      <View style={styles.memberText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {member.displayName}
          {member.isMe ? (
            <AppText variant="caption" color={colors.secondary}>
              {'  '}(Та)
            </AppText>
          ) : null}
        </AppText>
        <View style={styles.badgeRow}>
          <RoleBadge role={member.role} />
        </View>
      </View>
      {onPress ? <ChevronRight size={20} color={colors.secondary} /> : null}
    </>
  );

  return onPress ? (
    <PressableScale
      onPress={onPress}
      style={styles.memberRow}
      accessibilityRole="button"
      accessibilityLabel={`${member.displayName}, үйлдлүүд`}
    >
      {content}
    </PressableScale>
  ) : (
    <View style={styles.memberRow}>{content}</View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.xs },
  heroTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: { gap: spacing.xs },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  memberText: { flex: 1, gap: spacing.xxs },
  badgeRow: { flexDirection: 'row' },
});
