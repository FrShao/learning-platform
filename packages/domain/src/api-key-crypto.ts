import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const API_KEY_PREFIX_LABEL = 'lp_live_';
const DISPLAY_PREFIX_LENGTH = 8;

/**
 * Generate a high-entropy API key secret. Format: `lp_live_<base64url>`.
 */
export function generateApiKeySecret(): string {
  const random = randomBytes(32).toString('base64url');
  return `${API_KEY_PREFIX_LABEL}${random}`;
}

/**
 * Non-secret display hint: first 8 characters of the secret.
 */
export function apiKeyDisplayPrefix(secret: string): string {
  return secret.slice(0, DISPLAY_PREFIX_LENGTH);
}

/**
 * Hash an API key secret with SHA-256 (hex). Suitable for unique lookup of high-entropy secrets.
 */
export function hashApiKey(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/**
 * Constant-time compare of a presented secret against a stored SHA-256 hex hash.
 */
export function verifyApiKey(secret: string, keyHash: string): boolean {
  const presented = Buffer.from(hashApiKey(secret), 'utf8');
  const stored = Buffer.from(keyHash, 'utf8');
  if (presented.length !== stored.length) {
    return false;
  }
  return timingSafeEqual(presented, stored);
}
