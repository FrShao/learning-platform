/** Canonical domain types and pure helpers. See docs/domain-object-models.md. */

export type { ApiKeyId, CourseId, OrgId, RefreshTokenId, SessionId, UserId } from './ids.js';

export type {
  AccessTokenClaims,
  ApiKey,
  ApiKeyCreated,
  ApiKeyScope,
  OAuthProvider,
  Organization,
  OrgMembership,
  OrgRole,
  OrgSettings,
  PublicUser,
  RefreshToken,
  User,
} from './identity.js';

export {
  API_KEY_SCOPES,
  DEFAULT_ORG_SETTINGS,
  normalizeEmail,
  ORG_ROLES,
  toPublicUser,
} from './identity.js';

export { isValidOrgSlug, normalizeOrgSlug } from './org-slug.js';

export type { OrgCapability } from './roles.js';
export {
  canAssignRole,
  canChangeSoleOwner,
  canManageMemberRole,
  roleHasCapability,
} from './roles.js';

export { hashPassword, verifyPassword } from './password.js';

export {
  apiKeyDisplayPrefix,
  generateApiKeySecret,
  hashApiKey,
  verifyApiKey,
} from './api-key-crypto.js';
