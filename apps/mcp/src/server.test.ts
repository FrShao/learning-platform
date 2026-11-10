import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { createMockApiClient } from './api/mock-client.js';
import { createAuthoringMcpServer } from './server.js';
import { TOOL_NAMES } from './tools/schemas.js';

describe('MCP server tool registration', () => {
  it('exposes all authoring tools over the protocol', async () => {
    const { api } = createMockApiClient();
    const server = createAuthoringMcpServer({ api, defaultOrgId: 'org_1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const listed = await client.listTools();
    const names = listed.tools.map((t) => t.name).sort();
    expect(names).toEqual([...TOOL_NAMES].sort());

    for (const tool of listed.tools) {
      expect(tool.description?.length ?? 0).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    }

    await client.close();
    await server.close();
  });

  it('invokes list_courses through tools/call with mock API', async () => {
    const { api, calls } = createMockApiClient();
    const server = createAuthoringMcpServer({ api, defaultOrgId: 'org_1' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: 'list_courses',
      arguments: {},
    });
    expect(result.isError).toBeFalsy();
    expect(calls[0]).toMatchObject({ method: 'listCourses', args: ['org_1'] });

    await client.close();
    await server.close();
  });
});
