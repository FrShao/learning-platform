import type { Asset } from '@lp/domain';

import type { AssetRow } from '../schema/assets.js';

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function mapAsset(row: AssetRow): Asset {
  return {
    id: row.id,
    orgId: row.orgId,
    mime: row.mime,
    size: row.size,
    storageKey: row.storageKey,
    originalFilename: row.originalFilename,
    createdBy: row.createdBy,
    createdAt: asDate(row.createdAt),
    deletedAt: row.deletedAt ? asDate(row.deletedAt) : null,
  };
}
