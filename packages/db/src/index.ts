/** Database client and migrations package (stub). Schema lands in Phase 1. */

export interface DbHealth {
  ok: boolean;
  message: string;
}

/**
 * Report whether a database URL is configured. Does not open a connection yet.
 */
export function getDbHealth(databaseUrl: string | undefined): DbHealth {
  if (!databaseUrl || databaseUrl.trim() === '') {
    return { ok: false, message: 'DATABASE_URL is not set' };
  }
  return { ok: true, message: 'DATABASE_URL is configured (client not wired)' };
}
