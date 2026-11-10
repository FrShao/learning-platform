import { describe, expect, it } from 'vitest';

import {
  canAssignRole,
  canChangeSoleOwner,
  canManageMemberRole,
  roleHasCapability,
} from './roles.js';

describe('roleHasCapability', () => {
  it('grants manage_members to owner and admin only', () => {
    expect(roleHasCapability('owner', 'manage_members')).toBe(true);
    expect(roleHasCapability('admin', 'manage_members')).toBe(true);
    expect(roleHasCapability('author', 'manage_members')).toBe(false);
    expect(roleHasCapability('learner', 'manage_members')).toBe(false);
  });

  it('allows authors to publish but not manage API keys', () => {
    expect(roleHasCapability('author', 'publish_courses')).toBe(true);
    expect(roleHasCapability('author', 'manage_api_keys')).toBe(false);
  });
});

describe('canManageMemberRole / canAssignRole', () => {
  it('allows owners to manage and assign any role', () => {
    expect(canManageMemberRole('owner', 'owner')).toBe(true);
    expect(canAssignRole('owner', 'owner')).toBe(true);
    expect(canAssignRole('owner', 'learner')).toBe(true);
  });

  it('prevents admins from touching or assigning owners', () => {
    expect(canManageMemberRole('admin', 'owner')).toBe(false);
    expect(canManageMemberRole('admin', 'author')).toBe(true);
    expect(canAssignRole('admin', 'owner')).toBe(false);
    expect(canAssignRole('admin', 'admin')).toBe(true);
  });

  it('denies authors and learners member management', () => {
    expect(canManageMemberRole('author', 'learner')).toBe(false);
    expect(canAssignRole('learner', 'learner')).toBe(false);
  });
});

describe('canChangeSoleOwner', () => {
  it('blocks demote/remove of the sole owner', () => {
    expect(canChangeSoleOwner({ targetRole: 'owner', ownerCount: 1, action: 'demote' })).toBe(
      false,
    );
    expect(canChangeSoleOwner({ targetRole: 'owner', ownerCount: 1, action: 'remove' })).toBe(
      false,
    );
  });

  it('allows transfer of the sole owner and demote when multiple owners exist', () => {
    expect(canChangeSoleOwner({ targetRole: 'owner', ownerCount: 1, action: 'transfer' })).toBe(
      true,
    );
    expect(canChangeSoleOwner({ targetRole: 'owner', ownerCount: 2, action: 'demote' })).toBe(true);
  });
});
