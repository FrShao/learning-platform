import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env['DATABASE_URL'];

if (!databaseUrl || databaseUrl.trim() === '') {
  console.error('[db] migrate:deploy — DATABASE_URL is required');
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '..', 'migrations');

const sql = postgres(databaseUrl, { max: 1 });
const db = drizzle(sql);

try {
  console.log(`[db] migrate:deploy — applying migrations from ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log('[db] migrate:deploy — complete');
  process.exitCode = 0;
} catch (err) {
  console.error('[db] migrate:deploy — failed', err);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
