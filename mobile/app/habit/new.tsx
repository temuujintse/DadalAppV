import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { LoadingState } from '@/components/ui/StateViews';
import { useMe } from '@/features/auth/api';
import { useMembers } from '@/features/family/api';
import { familyUi } from '@/features/family/roles';
import { useCreateHabit } from '@/features/habits/api';
import { HabitForm } from '@/features/habits/components/HabitForm';
import { defaultHabitForm } from '@/features/habits/schemas';
import { errorMessage } from '@/services/api/errors';

export default function NewHabitScreen() {
  const me = useMe();
  const members = useMembers();
  const create = useCreateHabit();
  const initialValues = useMemo(() => defaultHabitForm(), []);

  if (!me.data || members.isPending) return <LoadingState />;
  const canManageFamily = me.data.family ? familyUi.canEditFamily(me.data.family.role) : false;

  return (
    <HabitForm
      mode="create"
      initialValues={initialValues}
      members={members.data ?? []}
      canManageFamily={canManageFamily}
      submitting={create.isPending}
      serverError={create.isError ? errorMessage(create.error) : null}
      onSubmit={(v) =>
        create.mutate(
          {
            title: v.title,
            description: v.description || undefined,
            icon: v.icon,
            color: v.color,
            type: v.type,
            completionMode: v.type === 'FAMILY' ? v.completionMode : undefined,
            difficulty: v.difficulty,
            assignedUserIds: v.type === 'FAMILY' ? v.assignedUserIds : undefined,
            scheduleDays: v.scheduleDays,
            startDate: v.startDate,
            endDate: v.endDate ?? undefined,
          },
          {
            onSuccess: () => {
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.back();
            },
          },
        )
      }
    />
  );
}
