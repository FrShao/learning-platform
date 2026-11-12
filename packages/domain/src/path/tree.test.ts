import { describe, expect, it } from 'vitest';

import { DomainError } from '../course/types.js';

import {
  deletePathNode,
  insertPathNode,
  isDescendant,
  movePathNode,
  normalizeSiblingOrders,
  reorderPathSiblings,
  replacePathTree,
  rootNodes,
  validatePathTree,
} from './tree.js';
import type { PathNode } from './types.js';

function node(partial: Pick<PathNode, 'id' | 'parentId' | 'order'> & Partial<PathNode>): PathNode {
  return {
    pathId: 'path_1',
    courseId: 'course_1',
    sectionId: `sec_${partial.id}`,
    title: null,
    ...partial,
  };
}

describe('validatePathTree', () => {
  it('accepts an empty tree', () => {
    expect(() => validatePathTree([])).not.toThrow();
  });

  it('accepts a valid multi-root tree', () => {
    const nodes = [
      node({ id: 'a', parentId: null, order: 0 }),
      node({ id: 'b', parentId: null, order: 1 }),
      node({ id: 'a1', parentId: 'a', order: 0 }),
    ];
    expect(() => validatePathTree(nodes)).not.toThrow();
  });

  it('rejects duplicate ids', () => {
    expect(() =>
      validatePathTree([
        node({ id: 'a', parentId: null, order: 0 }),
        node({ id: 'a', parentId: null, order: 1 }),
      ]),
    ).toThrow(DomainError);
  });

  it('rejects missing parents', () => {
    expect(() => validatePathTree([node({ id: 'a', parentId: 'missing', order: 0 })])).toThrow(
      /missing parent/,
    );
  });

  it('rejects cycles', () => {
    const cyclic: PathNode[] = [
      node({ id: 'a', parentId: 'b', order: 0 }),
      node({ id: 'b', parentId: 'a', order: 0 }),
    ];
    expect(() => validatePathTree(cyclic)).toThrow(/Cycle/);
  });
});

describe('insertPathNode / movePathNode / deletePathNode', () => {
  it('inserts roots and children with normalized sibling order', () => {
    let nodes = insertPathNode([], {
      id: 'root',
      parentId: null,
      courseId: 'c1',
      sectionId: 's1',
      pathId: 'path_1',
    });
    nodes = insertPathNode(nodes, {
      id: 'child',
      parentId: 'root',
      courseId: 'c1',
      sectionId: 's2',
    });
    nodes = insertPathNode(
      nodes,
      {
        id: 'root2',
        parentId: null,
        courseId: 'c2',
        sectionId: 's3',
        order: 0,
      },
      'path_1',
    );

    expect(rootNodes(nodes).map((n) => n.id)).toEqual(['root2', 'root']);
    expect(nodes.find((n) => n.id === 'child')?.parentId).toBe('root');
  });

  it('moves a node and rejects cyclic moves', () => {
    let nodes = [
      node({ id: 'a', parentId: null, order: 0 }),
      node({ id: 'b', parentId: 'a', order: 0 }),
      node({ id: 'c', parentId: 'b', order: 0 }),
    ];
    expect(isDescendant(nodes, 'a', 'c')).toBe(true);

    expect(() => movePathNode(nodes, 'a', 'c')).toThrow(/descendant/);

    nodes = movePathNode(nodes, 'c', null, 0);
    expect(nodes.find((n) => n.id === 'c')?.parentId).toBeNull();
    expect(rootNodes(nodes).map((n) => n.id)).toEqual(['c', 'a']);
  });

  it('cascade-deletes a subtree', () => {
    const nodes = [
      node({ id: 'a', parentId: null, order: 0 }),
      node({ id: 'b', parentId: 'a', order: 0 }),
      node({ id: 'c', parentId: 'b', order: 0 }),
      node({ id: 'd', parentId: null, order: 1 }),
    ];
    const next = deletePathNode(nodes, 'a');
    expect(next.map((n) => n.id)).toEqual(['d']);
    expect(next[0]?.order).toBe(0);
  });

  it('reorders siblings', () => {
    const nodes = [
      node({ id: 'a', parentId: null, order: 0 }),
      node({ id: 'b', parentId: null, order: 1 }),
      node({ id: 'c', parentId: null, order: 2 }),
    ];
    const next = reorderPathSiblings(nodes, null, ['c', 'a', 'b']);
    expect(rootNodes(next).map((n) => n.id)).toEqual(['c', 'a', 'b']);
  });

  it('replacePathTree assigns pathId and normalizes', () => {
    const next = replacePathTree('path_x', [
      {
        id: 'a',
        parentId: null,
        title: 'A',
        order: 5,
        courseId: 'c',
        sectionId: 's',
      },
    ]);
    expect(next[0]?.pathId).toBe('path_x');
    expect(next[0]?.order).toBe(0);
  });

  it('normalizeSiblingOrders is stable for ties', () => {
    const nodes = normalizeSiblingOrders([
      node({ id: 'b', parentId: null, order: 0 }),
      node({ id: 'a', parentId: null, order: 0 }),
    ]);
    expect(rootNodes(nodes).map((n) => n.id)).toEqual(['a', 'b']);
  });
});
