export interface McpConfig {
  /** Base URL of the Learning Platform API (no trailing slash). */
  apiBaseUrl: string;
  /** Org-scoped API key sent as `X-Api-Key`. */
  apiKey: string;
  /** Optional default org for tools that omit `org_id`. */
  defaultOrgId: string | undefined;
  /** Health HTTP port (Docker / local probes). */
  httpPort: number;
  /** When true, start stdio MCP transport. */
  enableStdio: boolean;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Load MCP process configuration from env.
 * Required for API calls: `API_BASE_URL` (or `LP_API_URL`) and `LP_API_KEY` (or `API_KEY`).
 */
export function loadMcpConfig(env: Record<string, string | undefined> = process.env): McpConfig {
  const apiBaseUrlRaw = env['API_BASE_URL'] ?? env['LP_API_URL'] ?? 'http://127.0.0.1:3000';
  const apiKey = env['LP_API_KEY'] ?? env['API_KEY'] ?? '';
  const portRaw = env['MCP_HTTP_PORT'] ?? '3100';
  const port = Number.parseInt(portRaw, 10);
  const enableStdio = (env['MCP_TRANSPORT'] ?? 'stdio') !== 'none';

  return {
    apiBaseUrl: stripTrailingSlash(apiBaseUrlRaw),
    apiKey,
    defaultOrgId: env['LP_ORG_ID'] ?? env['ORG_ID'],
    httpPort: Number.isFinite(port) ? port : 3100,
    enableStdio,
  };
}
