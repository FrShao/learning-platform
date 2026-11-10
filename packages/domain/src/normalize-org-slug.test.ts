import { describe, expect, it } from 'vitest';

import { isValidOrgSlug, normalizeOrgSlug } from './org-slug.js';

describe('normalizeOrgSlug', () => {
  it('lowercases and trims', () => {
    expect(normalizeOrgSlug('  Acme Corp  ')).toBe('acme-corp');
  });

  it('collapses whitespace and strips invalid characters', () => {
    expect(normalizeOrgSlug('Hello World!!!')).toBe('hello-world');
  });
});

describe('isValidOrgSlug', () => {
  it('rejects empty and too-short slugs', () => {
    expect(isValidOrgSlug('')).toBe(false);
    expect(isValidOrgSlug('a')).toBe(false);
  });

  it('accepts normalized multi-character slugs', () => {
    expect(isValidOrgSlug('acme')).toBe(true);
  });

  it('rejects leading or trailing hyphens after normalization edge cases', () => {
    expect(isValidOrgSlug('--')).toBe(false);
  });
});
