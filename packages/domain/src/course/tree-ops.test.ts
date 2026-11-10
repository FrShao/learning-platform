import { describe, expect, it } from 'vitest';

import { applyTreePatch } from './tree-ops.js';
import { emptyCourseTree } from './tree.js';
import { DomainError } from './types.js';

describe('applyTreePatch', () => {
  it('upserts sections and normalizes order', () => {
    const tree = applyTreePatch(emptyCourseTree(), {
      ops: [
        {
          op: 'upsert_section',
          section: { id: 'sec_a', slug: 'intro', title: 'Intro', order: 5 },
        },
        {
          op: 'upsert_section',
          section: { id: 'sec_b', slug: 'next', title: 'Next', order: 9 },
        },
      ],
    });

    expect(tree.sections).toHaveLength(2);
    expect(tree.sections.map((s) => s.order)).toEqual([0, 1]);
  });

  it('upserts, reorders, and deletes blocks', () => {
    let tree = applyTreePatch(emptyCourseTree(), {
      ops: [
        {
          op: 'upsert_section',
          section: { id: 'sec_a', slug: 'intro', title: 'Intro', order: 0 },
        },
        {
          op: 'upsert_block',
          sectionId: 'sec_a',
          block: { id: 'blk_1', type: 'text', markdown: 'hello' },
        },
        {
          op: 'upsert_block',
          sectionId: 'sec_a',
          block: { id: 'blk_2', type: 'text', markdown: 'world' },
        },
      ],
    });

    tree = applyTreePatch(tree, {
      ops: [{ op: 'reorder_blocks', sectionId: 'sec_a', blockIds: ['blk_2', 'blk_1'] }],
    });
    expect(tree.sections[0]?.blocks.map((b) => b.id)).toEqual(['blk_2', 'blk_1']);

    tree = applyTreePatch(tree, {
      ops: [{ op: 'delete_block', sectionId: 'sec_a', blockId: 'blk_2' }],
    });
    expect(tree.sections[0]?.blocks).toHaveLength(1);
    expect(tree.sections[0]?.blocks[0]?.id).toBe('blk_1');
  });

  it('reorders and deletes sections', () => {
    let tree = applyTreePatch(emptyCourseTree(), {
      ops: [
        {
          op: 'upsert_section',
          section: { id: 'sec_a', slug: 'a', title: 'A', order: 0 },
        },
        {
          op: 'upsert_section',
          section: { id: 'sec_b', slug: 'b', title: 'B', order: 1 },
        },
      ],
    });

    tree = applyTreePatch(tree, {
      ops: [{ op: 'reorder_sections', sectionIds: ['sec_b', 'sec_a'] }],
    });
    expect(tree.sections.map((s) => s.id)).toEqual(['sec_b', 'sec_a']);
    expect(tree.sections.map((s) => s.order)).toEqual([0, 1]);

    tree = applyTreePatch(tree, {
      ops: [{ op: 'delete_section', sectionId: 'sec_b' }],
    });
    expect(tree.sections.map((s) => s.id)).toEqual(['sec_a']);
    expect(tree.sections[0]?.order).toBe(0);
  });

  it('rejects delete of missing section', () => {
    expect(() =>
      applyTreePatch(emptyCourseTree(), {
        ops: [{ op: 'delete_section', sectionId: 'missing' }],
      }),
    ).toThrow(DomainError);
  });

  it('rejects non-permutation reorder', () => {
    const tree = applyTreePatch(emptyCourseTree(), {
      ops: [
        {
          op: 'upsert_section',
          section: { id: 'sec_a', slug: 'a', title: 'A', order: 0 },
        },
      ],
    });

    expect(() =>
      applyTreePatch(tree, {
        ops: [{ op: 'reorder_sections', sectionIds: ['sec_a', 'sec_x'] }],
      }),
    ).toThrow(DomainError);
  });

  it('rejects invalid form blocks on commit-style validation', () => {
    expect(() =>
      applyTreePatch(emptyCourseTree(), {
        ops: [
          {
            op: 'upsert_section',
            section: { id: 'sec_a', slug: 'a', title: 'A', order: 0 },
          },
          {
            op: 'upsert_block',
            sectionId: 'sec_a',
            block: {
              id: 'blk_form',
              type: 'form',
              form: { questions: [] },
            },
          },
        ],
      }),
    ).toThrow(DomainError);
  });
});
