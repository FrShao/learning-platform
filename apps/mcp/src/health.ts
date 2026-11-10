import { createServer, type Server } from 'node:http';

/**
 * Minimal HTTP health listener for Docker Compose probes.
 */
export function startHealthServer(port: number): Server {
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
        status: 'ok',
        message: 'MCP course authoring tools; connect via stdio transport',
      }),
    );
  });

  server.listen(port, () => {
    console.error(`[mcp] health listening on :${port}`);
  });

  return server;
}
