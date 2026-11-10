import { describe, expect, it } from 'vitest';

import { createMockApiClient } from '../api/mock-client.js';

import * as handlers from './handlers.js';

describe('MCP authoring handlers', () => {
  it('list_courses uses default org when org_id omitted', async () => {
    const { api, calls } = createMockApiClient();
    const result = await handlers.listCourses(
      { api, defaultOrgId: 'org_default' },
      { org_id: undefined },
    );
    expect(result.isError).toBeUndefined();
    expect(calls[0]).toMatchObject({ method: 'listCourses', args: ['org_default'] });
  });

  it('list_courses errors when org is missing', async () => {
    const { api } = createMockApiClient();
    const result = await handlers.listCourses(
      { api, defaultOrgId: undefined },
      { org_id: undefined },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('org_id is required');
  });

  it('get_course merges metadata and branches', async () => {
    const { api } = createMockApiClient();
    const result = await handlers.getCourse({ api, defaultOrgId: undefined }, { course_id: 'c1' });
    const body = JSON.parse(result.content[0]?.text ?? '{}') as {
      course: { id: string };
      branches: { branches: unknown[] };
    };
    expect(body.course.id).toBe('c1');
    expect(body.branches.branches).toHaveLength(1);
  });

  it('add_section emits upsert_section tree op', async () => {
    const { api, calls } = createMockApiClient();
    const result = await handlers.addSection(
      { api, defaultOrgId: undefined },
      {
        course_id: 'c1',
        branch: undefined,
        slug: 'intro',
        title: 'Intro',
        order: 0,
        section_id: 'sec_fixed',
      },
    );
    expect(result.isError).toBeUndefined();
    const applyCall = calls.find((c) => c.method === 'applyTreeOps');
    expect(applyCall?.args[2]).toEqual([
      {
        op: 'upsert_section',
        section: { id: 'sec_fixed', slug: 'intro', title: 'Intro', order: 0 },
      },
    ]);
  });

  it('add_text_block and add_form_block build upsert_block ops', async () => {
    const { api, calls } = createMockApiClient();
    await handlers.addTextBlock(
      { api, defaultOrgId: undefined },
      {
        course_id: 'c1',
        branch: undefined,
        section_id: 's1',
        block_id: 'b1',
        markdown: 'Hello',
      },
    );
    await handlers.addFormBlock(
      { api, defaultOrgId: undefined },
      {
        course_id: 'c1',
        branch: undefined,
        section_id: 's1',
        block_id: 'b2',
        title: undefined,
        questions: [{ id: 'q1', type: 'boolean', prompt: 'OK?' }],
        pass_rule: 'all_correct',
        min_score: undefined,
      },
    );
    const opsCalls = calls.filter((c) => c.method === 'applyTreeOps');
    expect(opsCalls).toHaveLength(2);
    expect(opsCalls[0]?.args[2]).toEqual([
      {
        op: 'upsert_block',
        section_id: 's1',
        block: { id: 'b1', type: 'text', markdown: 'Hello' },
      },
    ]);
    expect(opsCalls[1]?.args[2]).toMatchObject([
      {
        op: 'upsert_block',
        section_id: 's1',
        block: {
          id: 'b2',
          type: 'form',
          pass_rule: 'all_correct',
        },
      },
    ]);
  });

  it('commit_course / create_branch / publish_course hit API', async () => {
    const { api, calls } = createMockApiClient();
    await handlers.commitCourse(
      { api, defaultOrgId: undefined },
      { course_id: 'c1', branch: undefined, message: 'wip' },
    );
    await handlers.createBranch(
      { api, defaultOrgId: undefined },
      { course_id: 'c1', name: 'draft', from_commit_id: 'c0' },
    );
    await handlers.publishCourse(
      { api, defaultOrgId: undefined },
      { course_id: 'c1', commit_id: 'c0' },
    );
    expect(calls.map((c) => c.method)).toEqual(['commitCourse', 'createBranch', 'publishCourse']);
  });

  it('upload_asset stubs JSON ingest', async () => {
    const { api, calls } = createMockApiClient();
    const result = await handlers.uploadAsset(
      { api, defaultOrgId: 'org_1' },
      {
        org_id: undefined,
        filename: 'x.png',
        content_type: undefined,
        content_base64: undefined,
        url: 'https://cdn.example/x.png',
      },
    );
    expect(result.isError).toBeUndefined();
    expect(calls[0]?.method).toBe('uploadAsset');
    expect(JSON.parse(result.content[0]?.text ?? '{}')).toMatchObject({
      id: 'asset_1',
      stub: true,
    });
  });
});
