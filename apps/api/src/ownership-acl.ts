/**
 * ACL helpers for user-owned vs org-owned courses and paths.
 */
import { getMembership, type Db } from '@lp/db';
import {
  canAuthorOwnedResource,
  canLearnOwnedResource,
  type OrgRole,
  type ResourceOwner,
} from '@lp/domain';

import type { CourseAuthContext } from './courses/auth-hook.js';
import { forbidden } from './errors.js';

export async function resolveOrgRole(
  db: Db,
  orgId: string,
  userId: string,
): Promise<OrgRole | null> {
  const membership = await getMembership(db, orgId, userId);
  return membership?.role ?? null;
}

export async function assertCanAuthorOwned(
  db: Db,
  owner: ResourceOwner,
  auth: CourseAuthContext,
): Promise<void> {
  if (owner.kind === 'org') {
    if (auth.orgId && auth.orgId !== owner.orgId) {
      throw forbidden('Org mismatch');
    }
    const orgRole =
      auth.actor.kind === 'api_key'
        ? ('author' as OrgRole) // API keys with courses:write already gated by assertCourseWrite
        : await resolveOrgRole(db, owner.orgId, auth.userId);
    if (!canAuthorOwnedResource(owner, { userId: auth.userId, orgRole })) {
      throw forbidden('Author role required for this organization');
    }
    return;
  }

  // Personal: JWT user must be the owner; API keys cannot author personal resources.
  if (auth.actor.kind === 'api_key') {
    throw forbidden('Personal resources require a user session');
  }
  if (!canAuthorOwnedResource(owner, { userId: auth.userId })) {
    throw forbidden('Only the owner can manage this resource');
  }
}

export async function assertCanLearnOwned(
  db: Db,
  owner: ResourceOwner,
  auth: CourseAuthContext,
): Promise<void> {
  if (owner.kind === 'user') {
    if (!canLearnOwnedResource(owner, { userId: auth.userId })) {
      throw forbidden('Cannot access this resource');
    }
    return;
  }
  if (auth.orgId && auth.orgId !== owner.orgId) {
    throw forbidden('Org mismatch');
  }
  const orgRole =
    auth.actor.kind === 'api_key'
      ? ('learner' as OrgRole)
      : await resolveOrgRole(db, owner.orgId, auth.userId);
  if (!canLearnOwnedResource(owner, { userId: auth.userId, orgRole })) {
    throw forbidden('Not a member of this organization');
  }
}

export function requireUserSession(auth: CourseAuthContext): string {
  if (auth.actor.kind !== 'user') {
    throw forbidden('A user session is required');
  }
  return auth.userId;
}
