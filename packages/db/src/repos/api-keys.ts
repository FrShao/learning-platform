import type { ApiKey, ApiKeyScope } from '@lp/domain';
import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from '../client.js';
import { mapApiKey } from '../mappers.js';
import { apiKeys } from '../schema/identity.js';

export async function insertApiKey(
  db: Db,
  input: {
    id: string;
    orgId: string;
    name: string;
    keyHash: string;
    prefix: string;
    scopes: ApiKeyScope[];
    createdBy: string;
  },
): Promise<ApiKey> {
  const now = new Date();
  const [row] = await db
    .insert(apiKeys)
    .values({
      id: input.id,
      orgId: input.orgId,
      name: input.name,
      keyHash: input.keyHash,
      prefix: input.prefix,
      scopes: input.scopes,
      createdBy: input.createdBy,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    })
    .returning();
  if (!row) {
    throw new Error('insertApiKey failed');
  }
  return mapApiKey(row);
}

export async function listApiKeysForOrg(db: Db, orgId: string): Promise<ApiKey[]> {
  const rows = await db.select().from(apiKeys).where(eq(apiKeys.orgId, orgId));
  return rows.map(mapApiKey);
}

export async function findApiKeyById(db: Db, orgId: string, keyId: string): Promise<ApiKey | null> {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.id, keyId)))
    .limit(1);
  return row ? mapApiKey(row) : null;
}

export async function findApiKeyByHash(db: Db, keyHash: string): Promise<ApiKey | null> {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1);
  return row ? mapApiKey(row) : null;
}

export async function revokeApiKey(
  db: Db,
  input: { orgId: string; keyId: string },
): Promise<ApiKey | null> {
  const [row] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(apiKeys.orgId, input.orgId), eq(apiKeys.id, input.keyId), isNull(apiKeys.revokedAt)),
    )
    .returning();
  return row ? mapApiKey(row) : null;
}

export async function touchApiKeyLastUsed(db: Db, keyId: string): Promise<void> {
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyId));
}
