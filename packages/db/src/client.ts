import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbClient {
  db: Db;
  sql: ReturnType<typeof postgres>;
  close: () => Promise<void>;
}

/**
 * Create a Drizzle client bound to `databaseUrl`.
 */
export function createDbClient(databaseUrl: string): DbClient {
  const sql = postgres(databaseUrl, { max: 10 });
  const db = drizzle(sql, { schema });
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}

/**
 * Create a standalone Drizzle `Db` (caller owns the underlying connection lifetime
 * via the process; prefer `createDbClient` when you need an explicit close).
 */
export function createDb(databaseUrl: string): Db {
  return createDbClient(databaseUrl).db;
}
