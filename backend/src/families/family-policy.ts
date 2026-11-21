import { FamilyRole } from '../generated/prisma/enums';

/**
 * Single source of truth for family role permissions (pure functions → easy to unit test).
 *
 * OWNER  – everything, incl. role changes and ownership transfer
 * PARENT – manage family settings, habits, quests, rewards; invite/remove MEMBER and CHILD
 * MEMBER – participate, manage own habits
 * CHILD  – participate; no administrative rights
 */
export const FamilyPermission = {
  UPDATE_FAMILY: 'UPDATE_FAMILY',
  INVITE_MEMBERS: 'INVITE_MEMBERS',
  REMOVE_MEMBERS: 'REMOVE_MEMBERS',
  CHANGE_ROLES: 'CHANGE_ROLES',
  TRANSFER_OWNERSHIP: 'TRANSFER_OWNERSHIP',
  MANAGE_FAMILY_HABITS: 'MANAGE_FAMILY_HABITS',
  MANAGE_QUESTS: 'MANAGE_QUESTS',
  MANAGE_REWARDS: 'MANAGE_REWARDS',
  DECIDE_REDEMPTIONS: 'DECIDE_REDEMPTIONS',
} as const;
export type FamilyPermission = (typeof FamilyPermission)[keyof typeof FamilyPermission];

const ALL = Object.values(FamilyPermission);

const MATRIX: Record<FamilyRole, ReadonlySet<FamilyPermission>> = {
  OWNER: new Set(ALL),
  PARENT: new Set<FamilyPermission>([
    FamilyPermission.UPDATE_FAMILY,
    FamilyPermission.INVITE_MEMBERS,
    FamilyPermission.REMOVE_MEMBERS,
    FamilyPermission.MANAGE_FAMILY_HABITS,
    FamilyPermission.MANAGE_QUESTS,
    FamilyPermission.MANAGE_REWARDS,
    FamilyPermission.DECIDE_REDEMPTIONS,
  ]),
  MEMBER: new Set<FamilyPermission>(),
  CHILD: new Set<FamilyPermission>(),
};

export function can(role: FamilyRole, permission: FamilyPermission): boolean {
  return MATRIX[role].has(permission);
}

/** Roles an actor may hand out through an invite. OWNER is never invitable. */
export function invitableRoles(actor: FamilyRole): FamilyRole[] {
  switch (actor) {
    case 'OWNER':
      return ['PARENT', 'MEMBER', 'CHILD'];
    case 'PARENT':
      return ['MEMBER', 'CHILD'];
    default:
      return [];
  }
}

export function canInviteAs(actor: FamilyRole, target: FamilyRole): boolean {
  return invitableRoles(actor).includes(target);
}

/** Removing someone else. Leaving yourself is handled separately. */
export function canRemoveMember(actor: FamilyRole, target: FamilyRole): boolean {
  if (target === 'OWNER') return false;
  if (actor === 'OWNER') return true;
  if (actor === 'PARENT') return target === 'MEMBER' || target === 'CHILD';
  return false;
}

/** Only the owner changes roles; OWNER is assigned exclusively via ownership transfer. */
export function canChangeRole(actor: FamilyRole, target: FamilyRole, next: FamilyRole): boolean {
  return actor === 'OWNER' && target !== 'OWNER' && next !== 'OWNER';
}
