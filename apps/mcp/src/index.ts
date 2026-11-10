import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createHttpApiClient } from './api/client.js';
import { loadMcpConfig } from './config.js';
import { startHealthServer } from './health.js';
import { createAuthoringMcpServer } from './server.js';

async function main(): Promise<void> {
  const config = loadMcpConfig();

  startHealthServer(config.httpPort);

  if (!config.enableStdio) {
    console.error('[mcp] MCP_TRANSPORT=none; health-only mode');
    return;
  }

  if (!config.apiKey) {
    console.error(
      '[mcp] warning: LP_API_KEY / API_KEY is empty; tool calls to the API will fail auth',
    );
  }

  const clientOpts: { apiBaseUrl: string; apiKey: string } = {
    apiBaseUrl: config.apiBaseUrl,
    apiKey: config.apiKey,
  };
  const api = createHttpApiClient(clientOpts);

  const serverOpts: {
    api: typeof api;
    defaultOrgId?: string;
  } = { api };
  if (config.defaultOrgId !== undefined) {
    serverOpts.defaultOrgId = config.defaultOrgId;
  }

  const server = createAuthoringMcpServer(serverOpts);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp] stdio transport ready (api=${config.apiBaseUrl}); tools registered`);
}

main().catch((err: unknown) => {
  console.error('[mcp] fatal', err);
  process.exit(1);
});
