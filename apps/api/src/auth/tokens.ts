import { createHash, randomBytes } from 'node:crypto';

import type { AccessTokenClaims, UserId } from '@lp/domain';
import { SignJWT, jwtVerify } from 'jose';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;
  refreshExpiresAt: Date;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/**
 * Issue a short-lived access JWT (`typ: access`).
 */
export async function signAccessToken(params: {
  userId: UserId;
  jwtSecret: string;
  ttlSeconds: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ typ: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(params.userId)
    .setIssuedAt(now)
    .setExpirationTime(now + params.ttlSeconds)
    .sign(secretKey(params.jwtSecret));
}

/**
 * Verify and parse an access JWT.
 */
export async function verifyAccessToken(
  token: string,
  jwtSecret: string,
): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(jwtSecret), {
    algorithms: ['HS256'],
  });
  if (payload.typ !== 'access' || typeof payload.sub !== 'string') {
    throw new Error('Invalid access token claims');
  }
  if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
    throw new Error('Invalid access token timestamps');
  }
  return {
    sub: payload.sub,
    typ: 'access',
    iat: payload.iat,
    exp: payload.exp,
  };
}

/**
 * Create an opaque refresh token plaintext + hash for storage.
 */
export function createRefreshTokenSecret(): { secret: string; hash: string } {
  const secret = randomBytes(48).toString('base64url');
  return { secret, hash: hashRefreshToken(secret) };
}

export function hashRefreshToken(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}
