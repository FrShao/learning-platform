import { describe, expect, it, vi } from 'vitest';

import { createHttpApiClient } from './client.js';
import { ApiClientError } from './types.js';

describe('HTTP API client', () => {
  it('sends X-Api-Key and hits /v1 course paths', async () => {
    const fetchImpl = vi.fn(
      async (url: string | URL, init?: { method?: string; headers?: Record<string, string> }) => {
        expect(String(url)).toBe('http://api.test/v1/orgs/org_1/courses');
        expect(init?.method).toBe('GET');
        expect(init?.headers?.['x-api-key']).toBe('secret');
        return new Response(JSON.stringify({ courses: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    );

    const api = createHttpApiClient({
      apiBaseUrl: 'http://api.test',
      apiKey: 'secret',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(api.listCourses('org_1')).resolves.toEqual({ courses: [] });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('PATCHes tree ops and POSTs publish with snake_case bodies', async () => {
    const seen: Array<{ url: string; method: string; body: unknown }> = [];
    const fetchImpl = vi.fn(
      async (url: string | URL, init?: { method?: string; body?: string }) => {
        seen.push({
          url: String(url),
          method: init?.method ?? 'GET',
          body: init?.body ? JSON.parse(init.body) : undefined,
        });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    );

    const api = createHttpApiClient({
      apiBaseUrl: 'http://api.test/',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await api.applyTreeOps('c1', 'main', [{ op: 'delete_section', section_id: 's1' }]);
    await api.publishCourse('c1', 'commit_9');

    expect(seen[0]).toEqual({
      url: 'http://api.test/v1/courses/c1/branches/main/tree',
      method: 'PATCH',
      body: { ops: [{ op: 'delete_section', section_id: 's1' }] },
    });
    expect(seen[1]).toEqual({
      url: 'http://api.test/v1/courses/c1/publish',
      method: 'POST',
      body: { commit_id: 'commit_9' },
    });
  });

  it('maps API error bodies to ApiClientError', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'not_found', message: 'missing', details: { id: 'x' } },
          }),
          { status: 404 },
        ),
    );

    const api = createHttpApiClient({
      apiBaseUrl: 'http://api.test',
      apiKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(api.getCourse('missing')).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 404,
      code: 'not_found',
      message: 'missing',
    } satisfies Partial<ApiClientError>);
  });
});
