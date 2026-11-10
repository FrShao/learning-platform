import { createServer } from 'node:http';

import { loadEnv } from '@lp/config';
import { getDbHealth } from '@lp/db';

const env = loadEnv();

const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    const db = getDbHealth(env.databaseUrl);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'api',
        db,
      }),
    );
    return;
  }

  if (req.url === '/v1' || req.url === '/v1/') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ name: 'learning-platform-api', version: 'v1', status: 'stub' }));
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: { code: 'not_found', message: 'Not found' } }));
});

server.listen(env.port, () => {
  console.log(`[api] listening on :${env.port}`);
});
