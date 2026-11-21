import { can, FamilyPermission } from '../families/family-policy';
import { FamilyRole } from '../generated/prisma/enums';

/**
 * Who may see / manage / complete a habit (pure → unit-testable).
 * - PERSONAL: only its creator.
 * - FAMILY: every member of that family can see it; OWNER/PARENT manage it;
 *   only assigned members can complete it.
 */
export interface HabitPolicyInput {
  habit: {
    type: 'PERSONAL' | 'FAMILY';
    creatorId: string;
    familyId: string | null;
    status: string;
  };
  userId: string;
  membership: { familyId: string; role: FamilyRole } | null;
  assigneeIds: string[];
}

export function canViewHabit({ habit, userId, membership }: HabitPolicyInput): boolean {
  if (habit.type === 'PERSONAL') return habit.creatorId === userId;
  return Boolean(membership && membership.familyId === habit.familyId);
}

export function canManageHabit(input: HabitPolicyInput): boolean {
  if (!canViewHabit(input)) return false;
  if (input.habit.type === 'PERSONAL') return input.habit.creatorId === input.userId;
  return can(input.membership!.role, FamilyPermission.MANAGE_FAMILY_HABITS);
}

export function canCompleteHabit(input: HabitPolicyInput): boolean {
  if (!canViewHabit(input) || input.habit.status !== 'ACTIVE') return false;
  if (input.habit.type === 'PERSONAL') return input.habit.creatorId === input.userId;
  return input.assigneeIds.includes(input.userId);
}
