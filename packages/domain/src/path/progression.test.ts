import { describe, expect, it } from 'vitest';

import {
  canCompletePathNode,
  computePathPercent,
  isPathNodeUnlocked,
  nextPathNodeId,
  pathNodeUnlockStates,
} from './progression.js';
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

const tree: PathNode[] = [
  node({ id: 'r1', parentId: null, order: 0 }),
  node({ id: 'r2', parentId: null, order: 1 }),
  node({ id: 'r1a', parentId: 'r1', order: 0 }),
  node({ id: 'r1b', parentId: 'r1', order: 1 }),
];

describe('path unlock progression', () => {
  it('unlocks all roots when sequential is off; children need parent', () => {
    expect(isPathNodeUnlocked(tree, [], 'r1', false)).toBe(true);
    expect(isPathNodeUnlocked(tree, [], 'r2', false)).toBe(true);
    expect(isPathNodeUnlocked(tree, [], 'r1a', false)).toBe(false);
    expect(isPathNodeUnlocked(tree, ['r1'], 'r1a', false)).toBe(true);
    expect(isPathNodeUnlocked(tree, ['r1'], 'r1b', false)).toBe(true);
  });

  it('enforces sibling order when sequential is on', () => {
    expect(isPathNodeUnlocked(tree, [], 'r1', true)).toBe(true);
    expect(isPathNodeUnlocked(tree, [], 'r2', true)).toBe(false);
    expect(isPathNodeUnlocked(tree, ['r1'], 'r2', true)).toBe(true);

    expect(isPathNodeUnlocked(tree, ['r1'], 'r1a', true)).toBe(true);
    expect(isPathNodeUnlocked(tree, ['r1'], 'r1b', true)).toBe(false);
    expect(isPathNodeUnlocked(tree, ['r1', 'r1a'], 'r1b', true)).toBe(true);
  });

  it('computes percent and next node', () => {
    expect(computePathPercent(tree, [])).toBe(0);
    expect(computePathPercent(tree, ['r1', 'r1a'])).toBe(50);
    expect(computePathPercent([], [])).toBe(100);

    expect(nextPathNodeId(tree, [], true)).toBe('r1');
    expect(nextPathNodeId(tree, ['r1'], true)).toBe('r1a');
    expect(nextPathNodeId(tree, ['r1', 'r1a', 'r1b'], true)).toBe('r2');
    expect(nextPathNodeId(tree, ['r1', 'r2', 'r1a', 'r1b'], true)).toBeNull();
  });

  it('canCompletePathNode respects unlock and prior completion', () => {
    expect(canCompletePathNode(tree, [], 'r1', true)).toBe(true);
    expect(canCompletePathNode(tree, ['r1'], 'r1', true)).toBe(false);
    expect(canCompletePathNode(tree, [], 'r1a', true)).toBe(false);
  });

  it('pathNodeUnlockStates summarizes the tree', () => {
    const states = pathNodeUnlockStates(tree, ['r1'], true);
    const byId = Object.fromEntries(states.map((s) => [s.nodeId, s]));
    expect(byId['r1']?.completed).toBe(true);
    expect(byId['r1a']?.unlocked).toBe(true);
    expect(byId['r1b']?.unlocked).toBe(false);
    expect(byId['r2']?.unlocked).toBe(true);
  });
});
