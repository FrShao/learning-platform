import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildStorageKey, LocalBlobStorage } from './storage.js';

describe('LocalBlobStorage', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('writes and reads blobs under the root', async () => {
    dir = await mkdtemp(join(tmpdir(), 'lp-assets-'));
    const storage = new LocalBlobStorage(dir);
    const key = buildStorageKey('org_1', 'asset_1', 'photo.png');
    await storage.put(key, Buffer.from('hello'), 'image/png');
    expect(await storage.exists(key)).toBe(true);
    const stream = await storage.openReadStream(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString('utf8')).toBe('hello');
    const onDisk = await readFile(join(dir, ...key.split('/')));
    expect(onDisk.toString('utf8')).toBe('hello');
  });

  it('rejects path traversal keys', async () => {
    dir = await mkdtemp(join(tmpdir(), 'lp-assets-'));
    const storage = new LocalBlobStorage(dir);
    await expect(storage.put('../escape', Buffer.from('x'), 'image/png')).rejects.toThrow(
      /Invalid storage key/,
    );
  });
});
