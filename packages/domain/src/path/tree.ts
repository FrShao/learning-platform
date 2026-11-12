/**
 * Pure Path tree helpers: validate (strict single-parent tree, no cycles),
 * insert, move, delete, reorder siblings.
 */

import { DomainError } from '../course/types.js';

import type { PathNode, PathNodeId, PathNodeInput } from './types.js';

/** Clone nodes without sharing array/object identity. */
export function clonePathNodes(nodes: readonly PathNode[]): PathNode[] {
  return nodes.map((n) => ({ ...n }));
}

/** Children of `parentId` sorted by order, then id. */
export function childrenOf(nodes: readonly PathNode[], parentId: PathNodeId | null): PathNode[] {
  return nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.id.localeCompare(b.id);
    });
}

/** Root nodes (parentId null). */
export function rootNodes(nodes: readonly PathNode[]): PathNode[] {
  return childrenOf(nodes, null);
}

/** Normalize sibling `order` to contiguous 0..n-1 under each parent. */
export function normalizeSiblingOrders(nodes: readonly PathNode[]): PathNode[] {
  const byParent = new Map<string, PathNode[]>();
  for (const node of nodes) {
    const key = node.parentId ?? '';
    const group = byParent.get(key);
    if (group) {
      group.push(node);
    } else {
      byParent.set(key, [node]);
    }
  }

  const next = new Map<string, PathNode>();
  for (const group of byParent.values()) {
    group
      .sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.id.localeCompare(b.id);
      })
      .forEach((node, index) => {
        next.set(node.id, { ...node, order: index });
      });
  }
  return nodes.map((n) => next.get(n.id) ?? n);
}

/**
 * Validate a strict single-parent tree:
 * - unique ids
 * - parent references exist (or null)
 * - no cycles
 * - each node has at most one parent (enforced by parentId field)
 */
export function validatePathTree(nodes: readonly PathNode[]): void {
  const byId = new Map<string, PathNode>();
  for (const node of nodes) {
    if (!node.id) {
      throw new DomainError('validation', 'Path node id is required');
    }
    if (byId.has(node.id)) {
      throw new DomainError('validation', `Duplicate path node id: ${node.id}`);
    }
    if (!node.courseId || !node.sectionId) {
      throw new DomainError('validation', `Node ${node.id} requires courseId and sectionId`);
    }
    if (typeof node.order !== 'number' || !Number.isInteger(node.order) || node.order < 0) {
      throw new DomainError('validation', `Node ${node.id} has invalid order`);
    }
    byId.set(node.id, node);
  }

  for (const node of nodes) {
    if (node.parentId === null) continue;
    if (node.parentId === node.id) {
      throw new DomainError('validation', `Node ${node.id} cannot be its own parent`);
    }
    if (!byId.has(node.parentId)) {
      throw new DomainError(
        'validation',
        `Node ${node.id} references missing parent ${node.parentId}`,
      );
    }
  }

  // Cycle detection via ancestor walk
  for (const node of nodes) {
    const seen = new Set<string>();
    let current: PathNode | undefined = node;
    while (current?.parentId) {
      if (seen.has(current.id)) {
        throw new DomainError('validation', `Cycle detected involving node ${node.id}`);
      }
      seen.add(current.id);
      current = byId.get(current.parentId);
      if (!current) break;
      if (current.id === node.id) {
        throw new DomainError('validation', `Cycle detected involving node ${node.id}`);
      }
    }
  }
}

function resolvePathId(nodes: readonly PathNode[], pathId: string | undefined): string {
  if (pathId) return pathId;
  const first = nodes[0];
  if (!first) {
    throw new DomainError('validation', 'pathId is required when inserting into an empty tree');
  }
  return first.pathId;
}

/**
 * Insert a node. Default order = end of siblings under parent.
 * Returns a new normalized, validated node list.
 */
export function insertPathNode(
  nodes: readonly PathNode[],
  input: PathNodeInput,
  pathId?: string,
): PathNode[] {
  if (nodes.some((n) => n.id === input.id)) {
    throw new DomainError('validation', `Node already exists: ${input.id}`);
  }
  if (input.parentId !== null && !nodes.some((n) => n.id === input.parentId)) {
    throw new DomainError('validation', `Parent not found: ${input.parentId}`);
  }

  const siblings = childrenOf(nodes, input.parentId);
  const order =
    input.order !== undefined && Number.isInteger(input.order) && input.order >= 0
      ? input.order
      : siblings.length;

  const node: PathNode = {
    id: input.id,
    pathId: input.pathId ?? resolvePathId(nodes, pathId),
    parentId: input.parentId,
    title: input.title === undefined ? null : input.title,
    order,
    courseId: input.courseId,
    sectionId: input.sectionId,
  };

  // Shift siblings at/after insert order
  const next = nodes.map((n) => {
    if (n.parentId === node.parentId && n.order >= order) {
      return { ...n, order: n.order + 1 };
    }
    return { ...n };
  });
  next.push(node);

  const normalized = normalizeSiblingOrders(next);
  validatePathTree(normalized);
  return normalized;
}

/**
 * Move a node to a new parent (or root) and sibling order.
 * Rejects moves that would create a cycle (descendant as parent).
 */
export function movePathNode(
  nodes: readonly PathNode[],
  nodeId: PathNodeId,
  newParentId: PathNodeId | null,
  newOrder?: number,
): PathNode[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) {
    throw new DomainError('validation', `Node not found: ${nodeId}`);
  }
  if (newParentId === nodeId) {
    throw new DomainError('validation', 'Cannot move a node under itself');
  }
  if (newParentId !== null) {
    if (!nodes.some((n) => n.id === newParentId)) {
      throw new DomainError('validation', `Parent not found: ${newParentId}`);
    }
    if (isDescendant(nodes, nodeId, newParentId)) {
      throw new DomainError('validation', 'Cannot move a node under its descendant (cycle)');
    }
  }

  const without = nodes.filter((n) => n.id !== nodeId);
  const siblings = childrenOf(without, newParentId);
  const order =
    newOrder !== undefined && Number.isInteger(newOrder) && newOrder >= 0
      ? Math.min(newOrder, siblings.length)
      : siblings.length;

  const moved: PathNode = {
    ...node,
    parentId: newParentId,
    order,
  };

  const next = without.map((n) => {
    if (n.parentId === newParentId && n.order >= order) {
      return { ...n, order: n.order + 1 };
    }
    return { ...n };
  });
  next.push(moved);

  const normalized = normalizeSiblingOrders(next);
  validatePathTree(normalized);
  return normalized;
}

/** True when `maybeDescendant` is in the subtree of `ancestorId`. */
export function isDescendant(
  nodes: readonly PathNode[],
  ancestorId: PathNodeId,
  maybeDescendant: PathNodeId,
): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let current = byId.get(maybeDescendant);
  const seen = new Set<string>();
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true;
    if (seen.has(current.id)) return false;
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return false;
}

/**
 * Delete a node. Cascade-deletes the entire subtree.
 */
export function deletePathNode(nodes: readonly PathNode[], nodeId: PathNodeId): PathNode[] {
  if (!nodes.some((n) => n.id === nodeId)) {
    throw new DomainError('validation', `Node not found: ${nodeId}`);
  }

  const toRemove = new Set<string>();
  const collect = (id: string): void => {
    toRemove.add(id);
    for (const child of nodes) {
      if (child.parentId === id) collect(child.id);
    }
  };
  collect(nodeId);

  const remaining = nodes.filter((n) => !toRemove.has(n.id));
  const normalized = normalizeSiblingOrders(remaining);
  validatePathTree(normalized);
  return normalized;
}

/**
 * Reorder siblings under a parent. `orderedIds` must be a permutation of current sibling ids.
 */
export function reorderPathSiblings(
  nodes: readonly PathNode[],
  parentId: PathNodeId | null,
  orderedIds: readonly PathNodeId[],
): PathNode[] {
  const siblings = childrenOf(nodes, parentId);
  const existing = siblings.map((s) => s.id);
  if (existing.length !== orderedIds.length) {
    throw new DomainError('validation', 'orderedIds must be a permutation of sibling ids');
  }
  const existingSet = new Set(existing);
  const nextSet = new Set(orderedIds);
  if (existingSet.size !== existing.length || nextSet.size !== orderedIds.length) {
    throw new DomainError('validation', 'orderedIds contains duplicates');
  }
  for (const id of orderedIds) {
    if (!existingSet.has(id)) {
      throw new DomainError('validation', 'orderedIds must be a permutation of sibling ids');
    }
  }

  const orderById = new Map(orderedIds.map((id, index) => [id, index]));
  const next = nodes.map((n) => {
    if (n.parentId !== parentId) return n;
    const order = orderById.get(n.id);
    if (order === undefined) return n;
    return { ...n, order };
  });
  validatePathTree(next);
  return next;
}

/**
 * Replace the full tree for a path. Assigns pathId and validates.
 */
export function replacePathTree(
  pathId: string,
  nodes: readonly Omit<PathNode, 'pathId'>[],
): PathNode[] {
  const withPath: PathNode[] = nodes.map((n) => ({ ...n, pathId }));
  const normalized = normalizeSiblingOrders(withPath);
  validatePathTree(normalized);
  return normalized;
}
