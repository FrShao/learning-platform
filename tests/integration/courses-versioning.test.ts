import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createTestApp, uniqueEmail, uniqueSlug } from './helpers.js';

const databaseUrl = process.env['DATABASE_URL']?.trim();
const jwtSecret = process.env['JWT_SECRET']?.trim();
const hasDb = Boolean(databaseUrl && jwtSecret);

describe.skipIf(!hasDb)('course versioning API', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let orgId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const email = uniqueEmail('author');
    const password = 'password-ok-12';
    const register = await app.inject({
      method: 'POST',
      url: '/v1/auth/register',
      payload: { email, password, name: 'Course Author' },
    });
    expect(register.statusCode).toBe(201);
    token = (register.json() as { accessToken: string }).accessToken;

    const createOrg = await app.inject({
      method: 'POST',
      url: '/v1/orgs',
      headers: { authorization: `Bearer ${token}` },
      payload: { slug: uniqueSlug('course-org'), name: 'Course Org' },
    });
    expect(createOrg.statusCode).toBe(201);
    orgId = (createOrg.json() as { org: { id: string } }).org.id;
  }, 60_000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('creates a course, patches tree, commits, and publishes', async () => {
    const headers = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };

    const createRes = await app.inject({
      method: 'POST',
      url: `/v1/orgs/${orgId}/courses`,
      headers,
      payload: {
        slug: `intro-${randomUUID().slice(0, 8)}`,
        title: 'Intro Course',
        description: 'Versioning integration test',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = createRes.json() as {
      course: { id: string; publishedCommitId: string | null };
      branch: { name: string };
    };
    expect(created.branch.name).toBe('main');
    expect(created.course.publishedCommitId).toBeNull();
    const courseId = created.course.id;

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/v1/courses/${courseId}/branches/main/tree`,
      headers,
      payload: {
        ops: [
          {
            op: 'upsert_section',
            section: {
              id: 'sec_intro',
              slug: 'intro',
              title: 'Introduction',
              order: 0,
            },
          },
          {
            op: 'upsert_block',
            sectionId: 'sec_intro',
            block: { id: 'blk_1', type: 'text', markdown: 'Hello learners' },
          },
        ],
      },
    });
    expect(patchRes.statusCode).toBe(200);
    const patched = patchRes.json() as {
      workingTree: { dirtyTree: { sections: unknown[] } };
    };
    expect(patched.workingTree.dirtyTree.sections).toHaveLength(1);

    const diffRes = await app.inject({
      method: 'GET',
      url: `/v1/courses/${courseId}/branches/main/diff`,
      headers,
    });
    expect(diffRes.statusCode).toBe(200);
    const diff = diffRes.json() as { diff: { entries: unknown[] } };
    expect(diff.diff.entries.length).toBeGreaterThan(0);

    const commitRes = await app.inject({
      method: 'POST',
      url: `/v1/courses/${courseId}/branches/main/commit`,
      headers,
      payload: { message: 'Add intro section' },
    });
    expect(commitRes.statusCode).toBe(201);
    const committed = commitRes.json() as {
      commit: { id: string; message: string };
      branch: { headCommitId: string };
    };
    expect(committed.commit.message).toBe('Add intro section');
    expect(committed.branch.headCommitId).toBe(committed.commit.id);

    const historyRes = await app.inject({
      method: 'GET',
      url: `/v1/courses/${courseId}/commits?branch=main`,
      headers,
    });
    expect(historyRes.statusCode).toBe(200);
    const history = historyRes.json() as { commits: { id: string }[] };
    expect(history.commits[0]?.id).toBe(committed.commit.id);

    const publishRes = await app.inject({
      method: 'POST',
      url: `/v1/courses/${courseId}/publish`,
      headers,
      payload: { commit_id: committed.commit.id },
    });
    expect(publishRes.statusCode).toBe(200);
    const published = publishRes.json() as {
      course: { publishedCommitId: string };
    };
    expect(published.course.publishedCommitId).toBe(committed.commit.id);

    const branchRes = await app.inject({
      method: 'POST',
      url: `/v1/courses/${courseId}/branches`,
      headers,
      payload: { name: 'draft/lesson-2', from_commit_id: committed.commit.id },
    });
    expect(branchRes.statusCode).toBe(201);
  });
});
