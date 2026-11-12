import { DomainError } from './course/types.js';
import type { OrgRole } from './identity.js';
import type { OrgId, UserId } from './ids.js';
import { roleHasCapability } from './roles.js';

/** Exclusive owner of a course or path. */
export type ResourceOwner =
  | { kind: 'user'; userId: UserId }
  | { kind: 'org'; orgId: OrgId };

/**
 * Build a ResourceOwner from mutually exclusive DB columns.
 * Exactly one of orgId / ownerUserId must be set.
 */
export function resourceOwnerFromColumns(
  orgId: string | null | undefined,
  ownerUserId: string | null | undefined,
): ResourceOwner {
  const hasOrg = typeof orgId === 'string' && orgId.length > 0;
  const hasUser = typeof ownerUserId === 'string' && ownerUserId.length > 0;
  if (hasOrg && !hasUser) {
    return { kind: 'org', orgId };
  }
  if (hasUser && !hasOrg) {
    return { kind: 'user', userId: ownerUserId };
  }
  throw new DomainError(
    'validation',
    'Ownership must be exactly one of orgId or ownerUserId',
    { orgId: orgId ?? null, ownerUserId: ownerUserId ?? null },
  );
}

export function ownerOrgId(owner: ResourceOwner): OrgId | null {
  return owner.kind === 'org' ? owner.orgId : null;
}

export function ownerUserId(owner: ResourceOwner): UserId | null {
  return owner.kind === 'user' ? owner.userId : null;
}

/**
 * Authoring (create/edit/commit/publish/delete) for a course or path.
 * User-owned: only the owner user. Org-owned: author+ role.
 */
export function canAuthorOwnedResource(
  owner: ResourceOwner,
  actor: { userId: UserId; orgRole?: OrgRole | null },
): boolean {
  if (owner.kind === 'user') {
    return owner.userId === actor.userId;
  }
  return (
    actor.orgRole != null && roleHasCapability(actor.orgRole, 'create_edit_commit_courses')
  );
}

/**
 * Learning (view published / enroll) for a course or path.
 * User-owned: any authenticated caller (personal published content is learnable).
 * Org-owned: member with enroll capability.
 */
export function canLearnOwnedResource(
  owner: ResourceOwner,
  actor: { userId: UserId; orgRole?: OrgRole | null },
): boolean {
  if (owner.kind === 'user') {
    return true;
  }
  return actor.orgRole != null && roleHasCapability(actor.orgRole, 'enroll_take_courses');
}
