import { describe, expect, it } from 'vitest';

import { integrationEnabled } from './helpers.js';

describe('integration harness', () => {
  it('reports whether DATABASE_URL + JWT_SECRET are configured', () => {
    // Compose test profile / CI integration job set these; local unit CI may not.
    expect(typeof integrationEnabled()).toBe('boolean');
  });
});
