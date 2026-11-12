import { describe, expect, it } from 'vitest';

import { ASSET_ALLOWED_MIME, isAllowedAssetMime } from './types.js';

describe('isAllowedAssetMime', () => {
  it('accepts the image allowlist', () => {
    for (const mime of ASSET_ALLOWED_MIME) {
      expect(isAllowedAssetMime(mime)).toBe(true);
    }
  });

  it('rejects non-image or unknown types', () => {
    expect(isAllowedAssetMime('application/pdf')).toBe(false);
    expect(isAllowedAssetMime('image/svg+xml')).toBe(false);
    expect(isAllowedAssetMime('')).toBe(false);
  });
});
