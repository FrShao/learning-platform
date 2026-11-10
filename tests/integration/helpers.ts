import { loadEnv, requireRuntimeSecrets } from '@lp/config';

import { buildApp } from '../../apps/api/src/app.js';

export function integrationEnabled(): boolean {
  return Boolean(process.env['DATABASE_URL']?.trim() && process.env['JWT_SECRET']?.trim());
}

export async function createTestApp() {
  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
  });
  const secrets = requireRuntimeSecrets(env);
  const app = await buildApp({
    env,
    databaseUrl: secrets.databaseUrl,
    jwtSecret: secrets.jwtSecret,
    closeDbOnClose: true,
  });
  await app.ready();
  return app;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function uniqueSlug(prefix = 'org'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
