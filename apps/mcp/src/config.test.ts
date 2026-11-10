import { describe, expect, it } from 'vitest';

import { loadMcpConfig } from './config.js';

describe('loadMcpConfig', () => {
  it('reads API URL, key, org, and port from env aliases', () => {
    const cfg = loadMcpConfig({
      LP_API_URL: 'http://localhost:3000/',
      LP_API_KEY: 'lp_live_test',
      LP_ORG_ID: 'org_abc',
      MCP_HTTP_PORT: '3200',
    });
    expect(cfg.apiBaseUrl).toBe('http://localhost:3000');
    expect(cfg.apiKey).toBe('lp_live_test');
    expect(cfg.defaultOrgId).toBe('org_abc');
    expect(cfg.httpPort).toBe(3200);
    expect(cfg.enableStdio).toBe(true);
  });

  it('falls back to API_BASE_URL / API_KEY', () => {
    const cfg = loadMcpConfig({
      API_BASE_URL: 'http://api:3000',
      API_KEY: 'k',
      MCP_TRANSPORT: 'none',
    });
    expect(cfg.apiBaseUrl).toBe('http://api:3000');
    expect(cfg.apiKey).toBe('k');
    expect(cfg.enableStdio).toBe(false);
  });
});
