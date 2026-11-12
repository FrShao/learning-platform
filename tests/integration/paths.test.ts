import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, uniqueEmail, uniqueSlug } from './helpers.js';

const databaseUrl = process.env['DATABASE_URL']?.trim();
const jwtSecret = process.env['JWT_SECRET']?.trim();
const hasDb = Boolean(databaseUrl && jwtSecret);

describe.skipIf(!hasDb)('learning paths API', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let orgId: string;
  let courseId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const email = uniqueEmail('path-author');
    const password = 'password-ok-12';
    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, name: 'Path Author' },
    });
    expect(register.statusCode).toBe(201);
    token = (register.json() as { accessToken: string }).accessToken;

    const createOrg = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: uniqueSlug('path-org'), name: 'Path Org' },
    });
    expect(createOrg.statusCode).toBe(201);
    orgId = (createOrg.json() as { org: { id: string } }).org.id;

    const createCourse = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${orgId}/courses`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        slug: `path-course-${randomUUID().slice(0, 8)}`,
        title: 'Path Course',
        description: 'Lessons for path nodes',
      },
    });
    expect(createCourse.statusCode).toBe(201);
    courseId = (createCourse.json() as { course: { id: string } }).course.id;

    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/courses/${courseId}/branches/main/tree`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: {
        ops: [
          {
            op: 'upsert_section',
            section: { id: 'sec_a', slug: 'a', title: 'A', order: 0 },
          },
          {
            op: 'upsert_section',
            section: { id: 'sec_b', slug: 'b', title: 'B', order: 1 },
          },
          {
            op: 'upsert_section',
            section: { id: 'sec_c', slug: 'c', title: 'C', order: 2 },
          },
        ],
      },
    });
    expect(patch.statusCode).toBe(200);

    const commit = await app.inject({
      method: 'POST',
      url: `/v1/courses/${courseId}/branches/main/commit`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { message: 'Add sections for path' },
    });
    expect(commit.statusCode).toBe(201);
    const commitId = (commit.json() as { commit: { id: string } }).commit.id;

    const publish = await app.inject({
      method: 'POST',
      url: `/v1/courses/${courseId}/publish`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { commit_id: commitId },
    });
    expect(publish.statusCode).toBe(200);
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('CRUD path, put tree, and unlock children after parent complete', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${orgId}/paths`,
      headers,
      payload: {
        slug: `journey-${randomUUID().slice(0, 8)}`,
        title: 'Onboarding Path',
        description: 'Ordered lesson tree',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const pathId = (createRes.json() as { path: { id: string; title: string } }).path.id;
    expect((createRes.json() as { path: { title: string } }).path.title).toBe('Onboarding Path');

    const listRes = await app.inject({
      method: 'GET',
      url: `/v1/orgs/${orgId}/paths`,
      headers,
    });
    expect(listRes.statusCode).toBe(200);
    const listed = listRes.json() as { paths: Array<{ id: string }> };
    expect(listed.paths.some((p) => p.id === pathId)).toBe(true);

    const rootId = randomUUID();
    const childId = randomUUID();
    const root2Id = randomUUID();

    const putTree = await app.inject({
      method: 'PUT',
      url: `/v1/paths/${pathId}/tree`,
      headers,
      payload: {
        nodes: [
          {
            id: rootId,
            parentId: null,
            order: 0,
            courseId,
            sectionId: 'sec_a',
            title: 'Start',
          },
          {
            id: childId,
            parentId: rootId,
            order: 0,
            courseId,
            sectionId: 'sec_b',
          },
          {
            id: root2Id,
            parentId: null,
            order: 1,
            courseId,
            sectionId: 'sec_c',
          },
        ],
      },
    });
    expect(putTree.statusCode).toBe(200);
    const tree = putTree.json() as { nodes: Array<{ id: string; parentId: string | null }> };
    expect(tree.nodes).toHaveLength(3);

    const getTree = await app.inject({
      method: 'GET',
      url: `/v1/paths/${pathId}/tree`,
      headers,
    });
    expect(getTree.statusCode).toBe(200);

    const enroll = await app.inject({
      method: 'POST',
      url: `/v1/paths/${pathId}/enroll`,
      headers,
    });
    expect(enroll.statusCode).toBe(201);
    const enrolled = enroll.json() as {
      enrollment: { id: string };
      progress: { completedNodeIds: string[]; currentNodeId: string | null; percent: number };
    };
    const enrollmentId = enrolled.enrollment.id;
    expect(enrolled.progress.completedNodeIds).toEqual([]);
    expect(enrolled.progress.currentNodeId).toBe(rootId);
    expect(enrolled.progress.percent).toBe(0);

    const progress1 = await app.inject({
      method: 'GET',
      url: `/v1/path-enrollments/${enrollmentId}/progress`,
      headers,
    });
    expect(progress1.statusCode).toBe(200);
    const p1 = progress1.json() as { unlockedNodeIds: string[] };
    expect(p1.unlockedNodeIds).toContain(rootId);
    expect(p1.unlockedNodeIds).not.toContain(childId);
    expect(p1.unlockedNodeIds).not.toContain(root2Id);

    const lockChild = await app.inject({
      method: 'POST',
      url: `/v1/path-enrollments/${enrollmentId}/nodes/${childId}/complete`,
      headers,
    });
    expect(lockChild.statusCode).toBe(409);

    const completeRoot = await app.inject({
      method: 'POST',
      url: `/v1/path-enrollments/${enrollmentId}/nodes/${rootId}/complete`,
      headers,
    });
    expect(completeRoot.statusCode).toBe(200);
    const afterRoot = completeRoot.json() as {
      progress: { completedNodeIds: string[]; percent: number };
      unlockedNodeIds: string[];
    };
    expect(afterRoot.progress.completedNodeIds).toContain(rootId);
    expect(afterRoot.unlockedNodeIds).toContain(childId);
    expect(afterRoot.unlockedNodeIds).toContain(root2Id);

    const completeChild = await app.inject({
      method: 'POST',
      url: `/v1/path-enrollments/${enrollmentId}/nodes/${childId}/complete`,
      headers,
    });
    expect(completeChild.statusCode).toBe(200);

    const completeRoot2 = await app.inject({
      method: 'POST',
      url: `/v1/path-enrollments/${enrollmentId}/nodes/${root2Id}/complete`,
      headers,
    });
    expect(completeRoot2.statusCode).toBe(200);
    expect((completeRoot2.json() as { progress: { percent: number } }).progress.percent).toBe(100);

    const patchMeta = await app.inject({
      method: 'PATCH',
      url: `/v1/paths/${pathId}`,
      headers,
      payload: { title: 'Onboarding Path v2' },
    });
    expect(patchMeta.statusCode).toBe(200);
    expect((patchMeta.json() as { path: { title: string } }).path.title).toBe('Onboarding Path v2');
  });
});
