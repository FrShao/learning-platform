import type { Asset } from '@lp/domain';
import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from '../client.js';
import { mapAsset } from '../mappers/assets.js';
import { assets } from '../schema/assets.js';

export interface InsertAssetInput {
  id?: string;
  orgId: string;
  mime: string;
  size: number;
  storageKey: string;
  originalFilename: string | null;
  createdBy: string;
}

export async function insertAsset(db: Db, input: InsertAssetInput): Promise<Asset> {
  const values: {
    id?: string;
    orgId: string;
    mime: string;
    size: number;
    storageKey: string;
    originalFilename: string | null;
    createdBy: string;
  } = {
    orgId: input.orgId,
    mime: input.mime,
    size: input.size,
    storageKey: input.storageKey,
    originalFilename: input.originalFilename,
    createdBy: input.createdBy,
  };
  if (input.id) {
    values.id = input.id;
  }

  const [row] = await db.insert(assets).values(values).returning();
  if (!row) {
    throw new Error('insertAsset failed');
  }
  return mapAsset(row);
}

export async function findAssetById(db: Db, id: string): Promise<Asset | null> {
  const rows = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  const row = rows[0];
  return row ? mapAsset(row) : null;
}

export async function findAliveAssetById(db: Db, id: string): Promise<Asset | null> {
  const rows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
    .limit(1);
  const row = rows[0];
  return row ? mapAsset(row) : null;
}
