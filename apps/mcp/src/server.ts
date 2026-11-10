import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { LearningPlatformApi } from './api/client.js';
import { registerAuthoringTools } from './tools/register.js';

export interface CreateMcpServerOptions {
  api: LearningPlatformApi;
  defaultOrgId?: string;
  name?: string;
  version?: string;
}

/**
 * Build an MCP server with Learning Platform course authoring tools.
 */
export function createAuthoringMcpServer(options: CreateMcpServerOptions): McpServer {
  const server = new McpServer({
    name: options.name ?? 'learning-platform-mcp',
    version: options.version ?? '0.1.0',
  });

  const registerOpts: { api: LearningPlatformApi; defaultOrgId?: string } = {
    api: options.api,
  };
  if (options.defaultOrgId !== undefined) {
    registerOpts.defaultOrgId = options.defaultOrgId;
  }
  registerAuthoringTools(server, registerOpts);

  return server;
}
