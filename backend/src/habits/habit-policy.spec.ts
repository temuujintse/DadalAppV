import { canCompleteHabit, canManageHabit, canViewHabit, HabitPolicyInput } from './habit-policy';

const FAMILY_ID = 'f1';
const base = (over: Partial<HabitPolicyInput> = {}): HabitPolicyInput => ({
  habit: { type: 'FAMILY', creatorId: 'owner', familyId: FAMILY_ID, status: 'ACTIVE' },
  userId: 'kid',
  membership: { familyId: FAMILY_ID, role: 'CHILD' },
  assigneeIds: ['kid'],
  ...over,
});

describe('habit-policy', () => {
  it('keeps personal habits private to their creator', () => {
    const personal = {
      type: 'PERSONAL' as const,
      creatorId: 'me',
      familyId: null,
      status: 'ACTIVE',
    };
    expect(canViewHabit(base({ habit: personal, userId: 'me' }))).toBe(true);
    expect(canViewHabit(base({ habit: personal, userId: 'sibling' }))).toBe(false);
    expect(canManageHabit(base({ habit: personal, userId: 'me', membership: null }))).toBe(true);
  });

  it('shows family habits to every member of that family only', () => {
    expect(canViewHabit(base())).toBe(true);
    expect(canViewHabit(base({ membership: { familyId: 'other', role: 'OWNER' } }))).toBe(false);
    expect(canViewHabit(base({ membership: null }))).toBe(false);
  });

  it('lets only OWNER/PARENT manage family habits', () => {
    expect(canManageHabit(base())).toBe(false);
    expect(canManageHabit(base({ membership: { familyId: FAMILY_ID, role: 'PARENT' } }))).toBe(
      true,
    );
    expect(canManageHabit(base({ membership: { familyId: FAMILY_ID, role: 'MEMBER' } }))).toBe(
      false,
    );
  });

  it('lets only assigned members complete active family habits', () => {
    expect(canCompleteHabit(base())).toBe(true);
    expect(canCompleteHabit(base({ assigneeIds: ['someone-else'] }))).toBe(false);
    expect(
      canCompleteHabit(
        base({
          habit: { type: 'FAMILY', creatorId: 'owner', familyId: FAMILY_ID, status: 'ARCHIVED' },
        }),
      ),
    ).toBe(false);
  });
});
