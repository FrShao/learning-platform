import { createServer } from 'node:http';

import { loadEnv } from '@lp/config';

const env = loadEnv();
const portRaw = process.env['MCP_HTTP_PORT'] ?? String(env.port === 3000 ? 3100 : env.port);
const port = Number.parseInt(portRaw, 10);
const listenPort = Number.isFinite(port) ? port : 3100;

const server = createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mcp' }));
    return;
  }

  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(
    JSON.stringify({
      name: 'learning-platform-mcp',
      status: 'stub',
      message: 'MCP tools will share domain services with the REST API',
    }),
  );
});

server.listen(listenPort, () => {
  console.log(`[mcp] listening on :${listenPort}`);
});
