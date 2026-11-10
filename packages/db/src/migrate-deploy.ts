/**
 * Apply SQL migrations under packages/db/migrations in lexical order.
 * Tracks applied files in `_lp_migrations`.
 */
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function resolveMigrationsDir(): Promise<string> {
  const candidates = [
    path.resolve(__dirname, '../migrations'),
    path.resolve(__dirname, 'migrations'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next
    }
  }
  return candidates[0]!;
}

async function main(): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    console.error('[db] migrate:deploy — DATABASE_URL is required');
    process.exit(1);
  }

  const migrationsDir = await resolveMigrationsDir();
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS _lp_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;

    const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      const applied = await sql<{ id: string }[]>`
        SELECT id FROM _lp_migrations WHERE id = ${file}
      `;
      if (applied.length > 0) {
        console.log(`[db] skip ${file} (already applied)`);
        continue;
      }

      const body = await readFile(path.join(migrationsDir, file), 'utf8');
      // Drizzle-kit dumps use statement breakpoints; strip for raw execution.
      const normalized = body
        .split('--> statement-breakpoint')
        .map((part) => part.trim())
        .filter(Boolean)
        .join(';\n');

      console.log(`[db] applying ${file}`);
      await sql.begin(async (tx) => {
        await tx.unsafe(normalized);
        await tx`INSERT INTO _lp_migrations (id) VALUES (${file})`;
      });
      console.log(`[db] applied ${file}`);
    }

    console.log('[db] migrate:deploy complete');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err: unknown) => {
  console.error('[db] migrate:deploy failed', err);
  process.exit(1);
});
