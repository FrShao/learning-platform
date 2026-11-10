import type { DbClient } from './client.js';

export interface DbHealth {
  ok: boolean;
  message: string;
}

/**
 * Report whether a database URL is configured (no connection).
 */
export function getDbHealth(databaseUrl: string | undefined): DbHealth {
  if (!databaseUrl || databaseUrl.trim() === '') {
    return { ok: false, message: 'DATABASE_URL is not set' };
  }
  return { ok: true, message: 'DATABASE_URL is configured' };
}

/**
 * Ping Postgres with `select 1`.
 */
export async function pingDb(client: DbClient): Promise<DbHealth> {
  try {
    await client.sql`select 1`;
    return { ok: true, message: 'postgres reachable' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return { ok: false, message };
  }
}
