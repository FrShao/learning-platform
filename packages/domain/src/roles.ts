import type { OrgRole } from './identity.js';

export type OrgCapability =
  | 'manage_members'
  | 'manage_api_keys'
  | 'create_edit_commit_courses'
  | 'publish_courses'
  | 'enroll_take_courses'
  | 'transfer_ownership'
  | 'delete_org';

const ROLE_CAPABILITIES: Record<OrgRole, ReadonlySet<OrgCapability>> = {
  owner: new Set([
    'manage_members',
    'manage_api_keys',
    'create_edit_commit_courses',
    'publish_courses',
    'enroll_take_courses',
    'transfer_ownership',
    'delete_org',
  ]),
  admin: new Set([
    'manage_members',
    'manage_api_keys',
    'create_edit_commit_courses',
    'publish_courses',
    'enroll_take_courses',
  ]),
  author: new Set(['create_edit_commit_courses', 'publish_courses', 'enroll_take_courses']),
  learner: new Set(['enroll_take_courses']),
};

/**
 * Return true when `role` grants `capability`.
 */
export function roleHasCapability(role: OrgRole, capability: OrgCapability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

/**
 * Whether `actorRole` may change `targetRole` (add / patch / remove).
 * Owners may manage anyone; admins may manage non-owners; others may not.
 */
export function canManageMemberRole(actorRole: OrgRole, targetRole: OrgRole): boolean {
  if (!roleHasCapability(actorRole, 'manage_members')) {
    return false;
  }
  if (actorRole === 'owner') {
    return true;
  }
  // admin cannot elevate to owner or touch an owner
  if (targetRole === 'owner') {
    return false;
  }
  return actorRole === 'admin';
}

/**
 * Whether `actorRole` may assign `newRole` on create/patch.
 * Admins cannot assign owner; authors/learners cannot assign anything.
 */
export function canAssignRole(actorRole: OrgRole, newRole: OrgRole): boolean {
  if (!roleHasCapability(actorRole, 'manage_members')) {
    return false;
  }
  if (actorRole === 'owner') {
    return true;
  }
  if (actorRole === 'admin') {
    return newRole !== 'owner';
  }
  return false;
}

/**
 * Guard: demoting/removing the sole owner is forbidden.
 */
export function canChangeSoleOwner(params: {
  targetRole: OrgRole;
  ownerCount: number;
  action: 'demote' | 'remove' | 'transfer';
}): boolean {
  if (params.targetRole !== 'owner') {
    return true;
  }
  if (params.ownerCount > 1) {
    return true;
  }
  // sole owner may only leave via explicit transfer (handled separately)
  return params.action === 'transfer';
}
