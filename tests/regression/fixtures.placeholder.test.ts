import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

describe('regression harness', () => {
  it('loads a locked fixture from tests/fixtures', () => {
    const path = join(here, '../fixtures/sample-org.json');
    const raw = readFileSync(path, 'utf8');
    const data = JSON.parse(raw) as { slug: string };
    expect(data.slug).toBe('acme');
  });
});
