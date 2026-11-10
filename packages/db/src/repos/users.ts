import type { User } from '@lp/domain';
import { and, eq, isNull } from 'drizzle-orm';

import type { Db } from '../client.js';
import { mapUser } from '../mappers.js';
import { users } from '../schema/identity.js';

export async function insertUser(
  db: Db,
  input: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
  },
): Promise<User> {
  const now = new Date();
  const [row] = await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email,
      name: input.name,
      passwordHash: input.passwordHash,
      oauthSubject: null,
      oauthProvider: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    })
    .returning();
  if (!row) {
    throw new Error('insertUser failed');
  }
  return mapUser(row);
}

export async function findUserByEmail(db: Db, email: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), isNull(users.deletedAt)))
    .limit(1);
  return row ? mapUser(row) : null;
}

export async function findUserById(db: Db, id: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return row ? mapUser(row) : null;
}
