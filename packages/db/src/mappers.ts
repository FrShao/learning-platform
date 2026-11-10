import type {
  ApiKey,
  ApiKeyScope,
  Organization,
  OrgMembership,
  OrgRole,
  OrgSettings,
  RefreshToken,
  User,
} from '@lp/domain';
import { DEFAULT_ORG_SETTINGS } from '@lp/domain';

import type {
  ApiKeyRow,
  OrganizationRow,
  OrgMembershipRow,
  RefreshTokenRow,
  UserRow,
} from './schema.js';

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.passwordHash,
    oauthSubject: row.oauthSubject,
    oauthProvider: row.oauthProvider as User['oauthProvider'],
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    deletedAt: row.deletedAt ? asDate(row.deletedAt) : null,
  };
}

export function mapOrganization(row: OrganizationRow): Organization {
  const settings = (row.settings ?? DEFAULT_ORG_SETTINGS) as OrgSettings;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    settings: {
      enforceSequentialProgress: settings.enforceSequentialProgress ?? true,
      republishProgressPolicy: settings.republishProgressPolicy ?? 'keep',
    },
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    deletedAt: row.deletedAt ? asDate(row.deletedAt) : null,
  };
}

export function mapMembership(row: OrgMembershipRow): OrgMembership {
  return {
    orgId: row.orgId,
    userId: row.userId,
    role: row.role as OrgRole,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

export function mapApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    keyHash: row.keyHash,
    prefix: row.prefix,
    scopes: row.scopes as ApiKeyScope[],
    createdBy: row.createdBy,
    createdAt: asDate(row.createdAt),
    lastUsedAt: row.lastUsedAt ? asDate(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? asDate(row.revokedAt) : null,
  };
}

export function mapRefreshToken(row: RefreshTokenRow): RefreshToken {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    createdAt: asDate(row.createdAt),
    expiresAt: asDate(row.expiresAt),
    revokedAt: row.revokedAt ? asDate(row.revokedAt) : null,
    userAgent: row.userAgent,
    ip: row.ip,
  };
}
