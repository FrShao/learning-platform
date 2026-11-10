import { argon2id, hash, verify, type HashOptions } from 'argon2';

/** Argon2id options tuned for interactive login (OWASP-ish defaults). */
const ARGON2_OPTIONS: HashOptions = {
  type: argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

/**
 * Hash a password with Argon2id. Never log or return the plaintext.
 */
export async function hashPassword(password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  return hash(password, { ...ARGON2_OPTIONS, raw: false });
}

/**
 * Verify a plaintext password against an Argon2id hash.
 */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}
