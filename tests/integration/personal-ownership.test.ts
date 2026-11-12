import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, uniqueEmail } from './helpers.js';

const databaseUrl = process.env['DATABASE_URL']?.trim();
const jwtSecret = process.env['JWT_SECRET']?.trim();
const hasDb = Boolean(databaseUrl && jwtSecret);

describe.skipIf(!hasDb)('personal course and path ownership', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const email = uniqueEmail('personal-owner');
    const password = 'password-ok-12';
    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, name: 'Personal Owner' },
    });
    expect(register.statusCode).toBe(201);
    const body = register.json() as { accessToken: string; user: { id: string } };
    token = body.accessToken;
    userId = body.user.id;
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates and lists personal courses without an organization', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const slug = `personal-${randomUUID().slice(0, 8)}`;

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/me/courses',
      headers,
      payload: {
        slug,
        title: 'Personal Course',
        description: 'No org required',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      course: {
        id: string;
        orgId: string | null;
        ownerUserId: string | null;
        owner: { kind: string; userId?: string };
      };
      branch: { name: string };
    };
    expect(created.branch.name).toBe('main');
    expect(created.course.orgId).toBeNull();
    expect(created.course.ownerUserId).toBe(userId);
    expect(created.course.owner).toEqual({ kind: 'user', userId });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/me/courses',
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const listed = listRes.json() as { courses: Array<{ id: string; slug: string }> };
    expect(listed.courses.some((c) => c.id === created.course.id)).toBe(true);

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/courses/${created.course.id}/branches/main/tree`,
      headers,
      payload: {
        ops: [
          {
            op: 'upsert_section',
            section: { id: 'sec_p', slug: 'p', title: 'Personal', order: 0 },
          },
        ],
      },
    });
    expect(patchRes.statusCode).toBe(200);
  });

  it('creates and lists personal paths without an organization', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const slug = `personal-path-${randomUUID().slice(0, 8)}`;

    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/me/paths',
      headers,
      payload: {
        slug,
        title: 'Personal Path',
        description: 'No org required',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      path: {
        id: string;
        orgId: string | null;
        ownerUserId: string | null;
        owner: { kind: string; userId?: string };
      };
    };
    expect(created.path.orgId).toBeNull();
    expect(created.path.ownerUserId).toBe(userId);
    expect(created.path.owner).toEqual({ kind: 'user', userId });

    const listRes = await app.inject({
      method: 'GET',
      url: '/v1/me/paths',
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const listed = listRes.json() as { paths: Array<{ id: string }> };
    expect(listed.paths.some((p) => p.id === created.path.id)).toBe(true);
  });

  it('rejects another user authoring a personal course', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/me/courses',
      headers,
      payload: {
        slug: `owned-${randomUUID().slice(0, 8)}`,
        title: 'Owned Course',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const courseId = (createRes.json() as { course: { id: string } }).course.id;

    const other = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: {
        email: uniqueEmail('other-user'),
        password: 'password-ok-12',
        name: 'Other User',
      },
    });
    expect(other.statusCode).toBe(201);
    const otherToken = (other.json() as { accessToken: string }).accessToken;

    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/v1/courses/${courseId}`,
      headers: {
        authorization: `Bearer ${otherToken}`,
        'content-type': 'application/json',
      },
      payload: { title: 'Hijacked' },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});
