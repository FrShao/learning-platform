import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  addFormBlockInput,
  addSectionInput,
  applyTreeOpsInput,
  createCourseInput,
  listCoursesInput,
  TOOL_DESCRIPTIONS,
  TOOL_NAMES,
  uploadAssetInput,
} from './schemas.js';

describe('MCP tool schemas', () => {
  it('registers the plan §6 tool name set without duplicates', () => {
    expect(TOOL_NAMES).toHaveLength(15);
    expect(new Set(TOOL_NAMES).size).toBe(TOOL_NAMES.length);
    for (const name of TOOL_NAMES) {
      expect(TOOL_DESCRIPTIONS[name].length).toBeGreaterThan(0);
    }
  });

  it('accepts list_courses with optional org_id', () => {
    const schema = z.object(listCoursesInput);
    expect(schema.parse({})).toEqual({});
    expect(schema.parse({ org_id: 'org_1' })).toEqual({ org_id: 'org_1' });
  });

  it('requires create_course slug and title', () => {
    const schema = z.object(createCourseInput);
    expect(() => schema.parse({ slug: 'intro' })).toThrow();
    expect(schema.parse({ slug: 'intro', title: 'Intro' })).toMatchObject({
      slug: 'intro',
      title: 'Intro',
    });
  });

  it('defaults branch to main for tree helpers', () => {
    const schema = z.object(addSectionInput);
    const parsed = schema.parse({
      course_id: 'c1',
      slug: 's1',
      title: 'Section 1',
    });
    expect(parsed.branch).toBe('main');
  });

  it('requires at least one tree op', () => {
    const schema = z.object(applyTreeOpsInput);
    expect(() => schema.parse({ course_id: 'c1', ops: [] })).toThrow();
    expect(
      schema.parse({
        course_id: 'c1',
        ops: [{ op: 'delete_section', section_id: 's1' }],
      }).ops,
    ).toHaveLength(1);
  });

  it('requires form questions for add_form_block', () => {
    const schema = z.object(addFormBlockInput);
    expect(() => schema.parse({ course_id: 'c1', section_id: 's1', questions: [] })).toThrow();
  });

  it('accepts upload_asset with url or base64 fields', () => {
    const schema = z.object(uploadAssetInput);
    expect(
      schema.parse({
        filename: 'a.png',
        url: 'https://example.com/a.png',
      }),
    ).toMatchObject({ filename: 'a.png' });
  });
});
