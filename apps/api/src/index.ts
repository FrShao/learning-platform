import { loadEnv, requireRuntimeSecrets } from '@lp/config';

import { buildApp } from './app.js';

const env = loadEnv();
const secrets = requireRuntimeSecrets(env);

const app = await buildApp({
  env,
  databaseUrl: secrets.databaseUrl,
  jwtSecret: secrets.jwtSecret,
});

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
  console.log(`[api] listening on :${env.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
