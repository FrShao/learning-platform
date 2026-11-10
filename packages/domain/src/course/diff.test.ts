import { describe, expect, it } from 'vitest';

import { diffCourseTrees } from './diff.js';
import type { CourseTree } from './types.js';

describe('diffCourseTrees', () => {
  it('reports added and removed sections', () => {
    const base: CourseTree = {
      sections: [{ id: 'sec_old', slug: 'old', title: 'Old', order: 0, blocks: [] }],
    };
    const dirty: CourseTree = {
      sections: [{ id: 'sec_new', slug: 'new', title: 'New', order: 0, blocks: [] }],
    };

    const diff = diffCourseTrees(base, dirty);
    const kinds = diff.entries.map((e) => e.kind).sort();
    expect(kinds).toEqual(['section_added', 'section_removed']);
  });

  it('reports block changes within a section', () => {
    const base: CourseTree = {
      sections: [
        {
          id: 'sec_a',
          slug: 'a',
          title: 'A',
          order: 0,
          blocks: [{ id: 'blk_1', type: 'text', markdown: 'one' }],
        },
      ],
    };
    const dirty: CourseTree = {
      sections: [
        {
          id: 'sec_a',
          slug: 'a',
          title: 'A',
          order: 0,
          blocks: [
            { id: 'blk_1', type: 'text', markdown: 'ONE' },
            { id: 'blk_2', type: 'text', markdown: 'two' },
          ],
        },
      ],
    };

    const diff = diffCourseTrees(base, dirty);
    expect(diff.entries.some((e) => e.kind === 'block_changed')).toBe(true);
    expect(diff.entries.some((e) => e.kind === 'block_added')).toBe(true);
  });

  it('treats null base as empty tree', () => {
    const dirty: CourseTree = {
      sections: [{ id: 'sec_a', slug: 'a', title: 'A', order: 0, blocks: [] }],
    };
    const diff = diffCourseTrees(null, dirty);
    expect(diff.entries).toEqual([
      expect.objectContaining({ kind: 'section_added', sectionId: 'sec_a' }),
    ]);
  });
});
