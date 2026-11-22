import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ErrorState, LoadingState } from '@/components/ui/StateViews';
import { useMembers } from '@/features/family/api';
import { useHabit, useSetAssignees, useUpdateHabit } from '@/features/habits/api';
import { HabitForm } from '@/features/habits/components/HabitForm';
import { HabitFormValues } from '@/features/habits/schemas';
import { errorMessage } from '@/services/api/errors';

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useHabit(id);
  const members = useMembers();
  const update = useUpdateHabit(id);
  const assign = useSetAssignees(id);

  const initialValues = useMemo<HabitFormValues | null>(
    () =>
      habit.data
        ? {
            title: habit.data.title,
            description: habit.data.description ?? '',
            icon: habit.data.icon,
            color: habit.data.color,
            type: habit.data.type,
            completionMode: habit.data.completionMode ?? 'PER_MEMBER',
            difficulty: habit.data.difficulty,
            assignedUserIds: habit.data.assignees.map((a) => a.userId),
            scheduleDays: habit.data.scheduleDays,
            startDate: habit.data.startDate,
            endDate: habit.data.endDate,
            reminderTime: habit.data.reminderTime ?? null,
          }
        : null,
    // Initialise once per habit; later refetches must not reset the user's edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habit.data?.id],
  );

  if (habit.isPending || members.isPending) return <LoadingState />;
  if (habit.isError || !initialValues || !habit.data) {
    return <ErrorState message={errorMessage(habit.error)} onRetry={() => void habit.refetch()} />;
  }
  const isFamily = habit.data.type === 'FAMILY';
  const failure = update.error ?? assign.error;

  const onSubmit = async (v: HabitFormValues) => {
    try {
      await update.mutateAsync({
        title: v.title,
        description: v.description || null,
        icon: v.icon,
        color: v.color,
        difficulty: v.difficulty,
        scheduleDays: v.scheduleDays,
        endDate: v.endDate,
        reminderTime: v.reminderTime,
      });
      const before = [...initialValues.assignedUserIds].sort().join();
      if (isFamily && habit.data.canManage && [...v.assignedUserIds].sort().join() !== before) {
        await assign.mutateAsync(v.assignedUserIds);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      /* error shown through `failure` */
    }
  };

  return (
    <HabitForm
      mode="edit"
      initialValues={initialValues}
      members={members.data ?? []}
      canManageFamily={isFamily && habit.data.canManage}
      submitting={update.isPending || assign.isPending}
      serverError={failure ? errorMessage(failure) : null}
      onSubmit={(v) => void onSubmit(v)}
    />
  );
}
