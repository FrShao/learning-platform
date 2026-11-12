/**
 * Path learner unlock / progress helpers.
 *
 * Unlock rules:
 * - A node is unlocked when its parent is completed (roots have no parent gate).
 * - When `enforceSequential` is true, prior siblings under the same parent
 *   must also be completed (mirrors org sequential section settings).
 */

import { childrenOf, rootNodes } from './tree.js';
import type { PathNode, PathNodeId, PathNodeUnlockState } from './types.js';

export function isPathNodeCompleted(
  completedNodeIds: readonly PathNodeId[],
  nodeId: PathNodeId,
): boolean {
  return completedNodeIds.includes(nodeId);
}

/**
 * Whether a path node is unlocked for the learner.
 */
export function isPathNodeUnlocked(
  nodes: readonly PathNode[],
  completedNodeIds: readonly PathNodeId[],
  nodeId: PathNodeId,
  enforceSequential: boolean,
): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return false;

  const completed = new Set(completedNodeIds);

  if (node.parentId !== null) {
    if (!completed.has(node.parentId)) {
      return false;
    }
  }

  if (!enforceSequential) {
    return true;
  }

  const siblings = childrenOf(nodes, node.parentId);
  const index = siblings.findIndex((s) => s.id === nodeId);
  if (index < 0) return false;
  return siblings.slice(0, index).every((s) => completed.has(s.id));
}

/** Unlock/completion state for every node in the tree. */
export function pathNodeUnlockStates(
  nodes: readonly PathNode[],
  completedNodeIds: readonly PathNodeId[],
  enforceSequential: boolean,
): PathNodeUnlockState[] {
  const completed = new Set(completedNodeIds);
  return nodes.map((n) => ({
    nodeId: n.id,
    unlocked: isPathNodeUnlocked(nodes, completedNodeIds, n.id, enforceSequential),
    completed: completed.has(n.id),
  }));
}

/** Depth-first ordered walk (roots left-to-right, then subtrees). */
export function walkPathNodes(nodes: readonly PathNode[]): PathNode[] {
  const out: PathNode[] = [];
  const visit = (parentId: PathNodeId | null): void => {
    for (const child of childrenOf(nodes, parentId)) {
      out.push(child);
      visit(child.id);
    }
  };
  visit(null);
  return out;
}

/** Next incomplete unlocked node in walk order, or null. */
export function nextPathNodeId(
  nodes: readonly PathNode[],
  completedNodeIds: readonly PathNodeId[],
  enforceSequential: boolean,
): PathNodeId | null {
  const completed = new Set(completedNodeIds);
  for (const node of walkPathNodes(nodes)) {
    if (completed.has(node.id)) continue;
    if (isPathNodeUnlocked(nodes, completedNodeIds, node.id, enforceSequential)) {
      return node.id;
    }
  }
  return null;
}

/** Percent complete 0..100 over all nodes. Empty tree → 100. */
export function computePathPercent(
  nodes: readonly PathNode[],
  completedNodeIds: readonly PathNodeId[],
): number {
  if (nodes.length === 0) return 100;
  const completed = new Set(completedNodeIds);
  const count = nodes.filter((n) => completed.has(n.id)).length;
  return Math.round((count / nodes.length) * 100);
}

/**
 * Whether completing `nodeId` is allowed given unlock rules and that it is not
 * already completed.
 */
export function canCompletePathNode(
  nodes: readonly PathNode[],
  completedNodeIds: readonly PathNodeId[],
  nodeId: PathNodeId,
  enforceSequential: boolean,
): boolean {
  if (isPathNodeCompleted(completedNodeIds, nodeId)) {
    return false;
  }
  return isPathNodeUnlocked(nodes, completedNodeIds, nodeId, enforceSequential);
}

/** Convenience: roots only (for authoring summaries). */
export function pathRootCount(nodes: readonly PathNode[]): number {
  return rootNodes(nodes).length;
}
