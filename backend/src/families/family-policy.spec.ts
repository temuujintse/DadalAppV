import {
  can,
  canChangeRole,
  canInviteAs,
  canRemoveMember,
  FamilyPermission,
  invitableRoles,
} from './family-policy';

describe('family-policy', () => {
  it('gives OWNER every permission', () => {
    for (const p of Object.values(FamilyPermission)) expect(can('OWNER', p)).toBe(true);
  });

  it('lets PARENT manage but not change roles or transfer ownership', () => {
    expect(can('PARENT', FamilyPermission.INVITE_MEMBERS)).toBe(true);
    expect(can('PARENT', FamilyPermission.DECIDE_REDEMPTIONS)).toBe(true);
    expect(can('PARENT', FamilyPermission.CHANGE_ROLES)).toBe(false);
    expect(can('PARENT', FamilyPermission.TRANSFER_OWNERSHIP)).toBe(false);
  });

  it('gives MEMBER and CHILD no administrative permission', () => {
    for (const role of ['MEMBER', 'CHILD'] as const) {
      for (const p of Object.values(FamilyPermission)) expect(can(role, p)).toBe(false);
    }
  });

  it('never allows inviting an OWNER', () => {
    for (const role of ['OWNER', 'PARENT', 'MEMBER', 'CHILD'] as const) {
      expect(invitableRoles(role)).not.toContain('OWNER');
    }
  });

  it('restricts which roles each role can invite', () => {
    expect(canInviteAs('OWNER', 'PARENT')).toBe(true);
    expect(canInviteAs('PARENT', 'PARENT')).toBe(false);
    expect(canInviteAs('PARENT', 'CHILD')).toBe(true);
    expect(canInviteAs('MEMBER', 'CHILD')).toBe(false);
    expect(canInviteAs('CHILD', 'MEMBER')).toBe(false);
  });

  it('protects the OWNER from removal and limits PARENT to MEMBER/CHILD', () => {
    expect(canRemoveMember('OWNER', 'PARENT')).toBe(true);
    expect(canRemoveMember('PARENT', 'OWNER')).toBe(false);
    expect(canRemoveMember('PARENT', 'PARENT')).toBe(false);
    expect(canRemoveMember('PARENT', 'CHILD')).toBe(true);
    expect(canRemoveMember('MEMBER', 'CHILD')).toBe(false);
    expect(canRemoveMember('CHILD', 'CHILD')).toBe(false);
  });

  it('only lets the OWNER change roles, never to or from OWNER', () => {
    expect(canChangeRole('OWNER', 'MEMBER', 'PARENT')).toBe(true);
    expect(canChangeRole('OWNER', 'MEMBER', 'OWNER')).toBe(false);
    expect(canChangeRole('OWNER', 'OWNER', 'PARENT')).toBe(false);
    expect(canChangeRole('PARENT', 'MEMBER', 'CHILD')).toBe(false);
  });
});
