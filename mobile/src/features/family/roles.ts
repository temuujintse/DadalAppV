import type { FamilyRole } from '@/types/api';

export const ROLE_LABELS: Record<FamilyRole, string> = {
  OWNER: 'Эзэмшигч',
  PARENT: 'Эцэг эх',
  MEMBER: 'Гишүүн',
  CHILD: 'Хүүхэд',
};

/**
 * UI hints only — they decide which buttons to show. The backend enforces the same rules
 * (backend/src/families/family-policy.ts) and is the single authority.
 */
export const familyUi = {
  canInvite: (role: FamilyRole) => role === 'OWNER' || role === 'PARENT',
  invitableRoles: (role: FamilyRole): FamilyRole[] =>
    role === 'OWNER' ? ['MEMBER', 'CHILD', 'PARENT'] : role === 'PARENT' ? ['MEMBER', 'CHILD'] : [],
  canRemove: (actor: FamilyRole, target: FamilyRole) =>
    target !== 'OWNER' &&
    (actor === 'OWNER' || (actor === 'PARENT' && (target === 'MEMBER' || target === 'CHILD'))),
  canChangeRole: (actor: FamilyRole, target: FamilyRole) => actor === 'OWNER' && target !== 'OWNER',
  canTransferTo: (actor: FamilyRole, target: FamilyRole) =>
    actor === 'OWNER' && target !== 'OWNER' && target !== 'CHILD',
  canEditFamily: (role: FamilyRole) => role === 'OWNER' || role === 'PARENT',
};
