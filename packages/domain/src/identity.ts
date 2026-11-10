import type { ApiKeyId, OrgId, RefreshTokenId, UserId } from './ids.js';

export type OAuthProvider = 'github' | 'google' | 'microsoft';

export type OrgRole = 'owner' | 'admin' | 'author' | 'learner';

export type ApiKeyScope =
  'courses:read' | 'courses:write' | 'courses:publish' | 'assets:write' | 'members:read';

export interface User {
  id: UserId;
  email: string;
  name: string;
  passwordHash: string | null;
  oauthSubject: string | null;
  oauthProvider: OAuthProvider | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface OrgSettings {
  enforceSequentialProgress: boolean;
  republishProgressPolicy: 'keep' | 'reset';
}

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  enforceSequentialProgress: true,
  republishProgressPolicy: 'keep',
};

export interface Organization {
  id: OrgId;
  slug: string;
  name: string;
  settings: OrgSettings;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface OrgMembership {
  orgId: OrgId;
  userId: UserId;
  role: OrgRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKey {
  id: ApiKeyId;
  orgId: OrgId;
  name: string;
  keyHash: string;
  prefix: string;
  scopes: ApiKeyScope[];
  createdBy: UserId;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface ApiKeyCreated extends ApiKey {
  secret: string;
}

export interface RefreshToken {
  id: RefreshTokenId;
  userId: UserId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  userAgent: string | null;
  ip: string | null;
}

export interface AccessTokenClaims {
  sub: UserId;
  typ: 'access';
  iat: number;
  exp: number;
}

export const API_KEY_SCOPES: readonly ApiKeyScope[] = [
  'courses:read',
  'courses:write',
  'courses:publish',
  'assets:write',
  'members:read',
] as const;

export const ORG_ROLES: readonly OrgRole[] = ['owner', 'admin', 'author', 'learner'] as const;

/** Public user shape returned by the API (never includes passwordHash). */
export interface PublicUser {
  id: UserId;
  email: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
