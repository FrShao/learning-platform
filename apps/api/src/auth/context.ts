import type { ApiKey, ApiKeyScope, Organization, OrgMembership, OrgRole, User } from '@lp/domain';

/** Authenticated via Bearer JWT — user session. */
export interface JwtAuthContext {
  kind: 'jwt';
  user: User;
}

/** Authenticated via X-Api-Key — org-scoped automation actor. */
export interface ApiKeyAuthContext {
  kind: 'api_key';
  apiKey: ApiKey;
  org: Organization;
  scopes: ApiKeyScope[];
}

export type AuthContext = JwtAuthContext | ApiKeyAuthContext;

export function requireUser(auth: AuthContext | null): User {
  if (!auth || auth.kind !== 'jwt') {
    throw Object.assign(new Error('JWT required'), { code: 'unauthorized' });
  }
  return auth.user;
}

export function membershipRole(membership: OrgMembership | null): OrgRole | null {
  return membership?.role ?? null;
}
