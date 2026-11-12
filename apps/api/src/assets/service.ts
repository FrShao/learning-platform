import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

import type { Db } from '@lp/db';
import {
  findAliveAssetById,
  findAssetById,
  findOrganizationById,
  getMembership,
  insertAsset,
} from '@lp/db';
import { DomainError, isAllowedAssetMime, roleHasCapability, type Asset } from '@lp/domain';

import type { BlobStorage } from './storage.js';
import { buildStorageKey } from './storage.js';

export interface AssetServiceOptions {
  db: Db;
  storage: BlobStorage;
  maxAssetBytes: number;
  /** Base URL prefix for content links, e.g. http://localhost:3000/v1 */
  publicApiBaseUrl: string;
}

export class AssetService {
  private readonly db: Db;
  private readonly storage: BlobStorage;
  private readonly maxAssetBytes: number;
  private readonly publicApiBaseUrl: string;

  constructor(options: AssetServiceOptions) {
    this.db = options.db;
    this.storage = options.storage;
    this.maxAssetBytes = options.maxAssetBytes;
    this.publicApiBaseUrl = options.publicApiBaseUrl.replace(/\/$/, '');
  }

  contentUrl(assetId: string): string {
    return `${this.publicApiBaseUrl}/assets/${assetId}/content`;
  }

  async assertCanUpload(userId: string, orgId: string): Promise<void> {
    const org = await findOrganizationById(this.db, orgId);
    if (!org) {
      throw new DomainError('not_found', 'Organization not found');
    }
    const membership = await getMembership(this.db, orgId, userId);
    if (!membership) {
      throw new DomainError('not_found', 'Organization not found');
    }
    if (!roleHasCapability(membership.role, 'create_edit_commit_courses')) {
      throw Object.assign(new Error('Insufficient role to upload assets'), { statusCode: 403 });
    }
  }

  async assertCanRead(
    userId: string | null,
    orgId: string,
    scopes: string[] | null,
  ): Promise<void> {
    if (scopes) {
      const ok =
        scopes.includes('courses:read') ||
        scopes.includes('courses:write') ||
        scopes.includes('assets:write');
      if (!ok) {
        throw Object.assign(new Error('API key lacks asset read scope'), { statusCode: 403 });
      }
      return;
    }
    if (!userId) {
      throw Object.assign(new Error('Authentication required'), { statusCode: 401 });
    }
    const membership = await getMembership(this.db, orgId, userId);
    if (!membership) {
      throw Object.assign(new Error('Not a member of this organization'), { statusCode: 403 });
    }
  }

  async upload(input: {
    orgId: string;
    createdBy: string;
    mime: string;
    size: number;
    originalFilename: string | null;
    body: Readable | Buffer;
  }): Promise<{ asset: Asset; url: string }> {
    if (!isAllowedAssetMime(input.mime)) {
      throw new DomainError('validation', `Unsupported mime type: ${input.mime}`);
    }
    if (!Number.isFinite(input.size) || input.size <= 0) {
      throw new DomainError('validation', 'File size must be greater than 0');
    }
    if (input.size > this.maxAssetBytes) {
      throw new DomainError('validation', `File exceeds max size of ${this.maxAssetBytes} bytes`);
    }

    const org = await findOrganizationById(this.db, input.orgId);
    if (!org) {
      throw new DomainError('not_found', 'Organization not found');
    }

    const id = randomUUID();
    const storageKey = buildStorageKey(input.orgId, id, input.originalFilename);

    await this.storage.put(storageKey, input.body, input.mime);

    try {
      const asset = await insertAsset(this.db, {
        id,
        orgId: input.orgId,
        mime: input.mime,
        size: input.size,
        storageKey,
        originalFilename: input.originalFilename,
        createdBy: input.createdBy,
      });
      return { asset, url: this.contentUrl(asset.id) };
    } catch (err) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw err;
    }
  }

  async getMetadata(assetId: string): Promise<{ asset: Asset; url: string }> {
    const asset = await findAssetById(this.db, assetId);
    if (!asset || asset.deletedAt) {
      throw new DomainError('not_found', 'Asset not found');
    }
    return { asset, url: this.contentUrl(asset.id) };
  }

  async openContent(assetId: string): Promise<{ asset: Asset; stream: Readable }> {
    // Soft-deleted assets may still be served for published snapshots.
    const asset = await findAssetById(this.db, assetId);
    if (!asset) {
      throw new DomainError('not_found', 'Asset not found');
    }
    const stream = await this.storage.openReadStream(asset.storageKey);
    return { asset, stream };
  }

  async requireAlive(assetId: string): Promise<Asset> {
    const asset = await findAliveAssetById(this.db, assetId);
    if (!asset) {
      throw new DomainError('not_found', 'Asset not found');
    }
    return asset;
  }
}
