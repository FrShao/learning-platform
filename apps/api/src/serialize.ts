import type { ApiKey, Organization, OrgMembership, User } from '@lp/domain';
import { toPublicUser } from '@lp/domain';

export interface SerializedUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeUser(user: User): SerializedUser {
  const pub = toPublicUser(user);
  return {
    id: pub.id,
    email: pub.email,
    name: pub.name,
    createdAt: pub.createdAt.toISOString(),
    updatedAt: pub.updatedAt.toISOString(),
  };
}

export function serializeOrg(org: Organization): Record<string, unknown> {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    settings: org.settings,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export function serializeMembership(m: OrgMembership): Record<string, unknown> {
  return {
    orgId: m.orgId,
    userId: m.userId,
    role: m.role,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

export function serializeApiKey(key: ApiKey, secret?: string): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: key.id,
    orgId: key.orgId,
    name: key.name,
    prefix: key.prefix,
    scopes: key.scopes,
    createdBy: key.createdBy,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
  };
  if (secret !== undefined) {
    base['secret'] = secret;
  }
  return base;
}
