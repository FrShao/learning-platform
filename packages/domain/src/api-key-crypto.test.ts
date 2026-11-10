import { describe, expect, it } from 'vitest';

import {
  apiKeyDisplayPrefix,
  generateApiKeySecret,
  hashApiKey,
  verifyApiKey,
} from './api-key-crypto.js';

describe('API key crypto', () => {
  it('generates lp_live_ secrets with a stable display prefix', () => {
    const secret = generateApiKeySecret();
    expect(secret.startsWith('lp_live_')).toBe(true);
    expect(apiKeyDisplayPrefix(secret)).toBe(secret.slice(0, 8));
    expect(apiKeyDisplayPrefix(secret).length).toBe(8);
  });

  it('hashes deterministically and verifies the matching secret', () => {
    const secret = generateApiKeySecret();
    const hash = hashApiKey(secret);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hashApiKey(secret)).toBe(hash);
    expect(verifyApiKey(secret, hash)).toBe(true);
  });

  it('rejects a different secret against the same hash', () => {
    const a = generateApiKeySecret();
    const b = generateApiKeySecret();
    expect(verifyApiKey(b, hashApiKey(a))).toBe(false);
  });
});
