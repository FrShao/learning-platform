import { describe, expect, it } from 'vitest';

import { hashCourseTree } from '../../packages/domain/src/course/content-hash.js';
import {
  applyTreePatch,
  diffCourseTrees,
  emptyCourseTree,
} from '../../packages/domain/src/course/index.js';

/**
 * Locked versioning invariants: patch → dirty diff → hash stable for identical trees.
 */
describe('course versioning regression', () => {
  it('commit-equivalent trees share content hash; dirty differs from empty base', () => {
    const dirty = applyTreePatch(emptyCourseTree(), {
      ops: [
        {
          op: 'upsert_section',
          section: { id: 'sec_1', slug: 'one', title: 'One', order: 0 },
        },
        {
          op: 'upsert_block',
          sectionId: 'sec_1',
          block: { id: 'blk_1', type: 'text', markdown: 'body' },
        },
      ],
    });

    const again = applyTreePatch(emptyCourseTree(), {
      ops: [
        {
          op: 'upsert_section',
          section: {
            id: 'sec_1',
            slug: 'one',
            title: 'One',
            order: 0,
            blocks: [{ id: 'blk_1', type: 'text', markdown: 'body' }],
          },
        },
      ],
    });

    expect(hashCourseTree(dirty)).toBe(hashCourseTree(again));

    const { entries } = diffCourseTrees(null, dirty);
    expect(entries.some((e) => e.kind === 'section_added')).toBe(true);
    expect(diffCourseTrees(dirty, dirty).entries).toHaveLength(0);
  });
});
