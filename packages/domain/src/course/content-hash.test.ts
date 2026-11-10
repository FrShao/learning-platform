import { describe, expect, it } from 'vitest';

import { hashCourseTree } from './content-hash.js';
import type { CourseTree } from './types.js';

describe('hashCourseTree', () => {
  it('is stable for equivalent key order', () => {
    const a: CourseTree = {
      sections: [
        {
          id: 'sec_1',
          slug: 'intro',
          title: 'Intro',
          order: 0,
          blocks: [{ id: 'blk_1', type: 'text', markdown: 'hi' }],
        },
      ],
    };
    const b = structuredClone(a);
    expect(hashCourseTree(a)).toBe(hashCourseTree(b));
    expect(hashCourseTree(a)).toMatch(/^[a-f0-9]{64}$/);
  });

  it('changes when content changes', () => {
    const base: CourseTree = { sections: [] };
    const withSection: CourseTree = {
      sections: [
        {
          id: 'sec_1',
          slug: 'intro',
          title: 'Intro',
          order: 0,
          blocks: [],
        },
      ],
    };
    expect(hashCourseTree(base)).not.toBe(hashCourseTree(withSection));
  });
});
