import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface BlobStorage {
  put(storageKey: string, body: Readable | Buffer, contentType: string): Promise<void>;
  openReadStream(storageKey: string): Promise<Readable>;
  exists(storageKey: string): Promise<boolean>;
  delete(storageKey: string): Promise<void>;
}

/**
 * Local filesystem blob store (default when S3 is not configured).
 * Keys are relative paths under `rootDir` using `/` separators.
 */
export class LocalBlobStorage implements BlobStorage {
  private readonly rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
  }

  private resolveKey(storageKey: string): string {
    if (storageKey.includes('..') || storageKey.startsWith('/') || storageKey.includes('\\')) {
      throw new Error('Invalid storage key');
    }
    const full = resolve(this.rootDir, ...storageKey.split('/'));
    if (full !== this.rootDir && !full.startsWith(this.rootDir + sep)) {
      throw new Error('Invalid storage key');
    }
    return full;
  }

  async put(storageKey: string, body: Readable | Buffer, _contentType: string): Promise<void> {
    const full = this.resolveKey(storageKey);
    await mkdir(dirname(full), { recursive: true });
    if (Buffer.isBuffer(body)) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(full, body);
      return;
    }
    await pipeline(body, createWriteStream(full));
  }

  async openReadStream(storageKey: string): Promise<Readable> {
    const full = this.resolveKey(storageKey);
    if (!existsSync(full)) {
      throw new Error(`Blob not found: ${storageKey}`);
    }
    return createReadStream(full);
  }

  async exists(storageKey: string): Promise<boolean> {
    return existsSync(this.resolveKey(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    const full = this.resolveKey(storageKey);
    if (existsSync(full)) {
      await unlink(full);
    }
  }
}

export function buildStorageKey(orgId: string, assetId: string, filename: string | null): string {
  const safeName = (filename ?? 'blob')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return `${orgId}/${assetId}_${safeName || 'blob'}`;
}
