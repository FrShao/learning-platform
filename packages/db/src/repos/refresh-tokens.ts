import type { RefreshToken } from '@lp/domain';
import { and, eq, gt, isNull } from 'drizzle-orm';

import type { Db } from '../client.js';
import { mapRefreshToken } from '../mappers.js';
import { refreshTokens } from '../schema/identity.js';

export async function insertRefreshToken(
  db: Db,
  input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent: string | null;
    ip: string | null;
  },
): Promise<RefreshToken> {
  const now = new Date();
  const [row] = await db
    .insert(refreshTokens)
    .values({
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      createdAt: now,
      expiresAt: input.expiresAt,
      revokedAt: null,
      userAgent: input.userAgent,
      ip: input.ip,
    })
    .returning();
  if (!row) {
    throw new Error('insertRefreshToken failed');
  }
  return mapRefreshToken(row);
}

export async function findValidRefreshToken(
  db: Db,
  tokenHash: string,
): Promise<RefreshToken | null> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, tokenHash),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return row ? mapRefreshToken(row) : null;
}

export async function revokeRefreshToken(db: Db, id: string): Promise<void> {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.id, id), isNull(refreshTokens.revokedAt)));
}
