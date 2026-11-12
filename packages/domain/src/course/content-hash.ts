import { createHash } from 'node:crypto';

import type { CourseTree } from './types.js';
import { canonicalizeTreeJson } from './canonicalize.js';

export { canonicalizeTreeJson } from './canonicalize.js';

/**
 * SHA-256 hex digest of the canonical course tree JSON.
 * Node-only (`node:crypto`) — import from `@lp/domain/course-hash` in server code.
 */
export function hashCourseTree(tree: CourseTree): string {
  return createHash('sha256').update(canonicalizeTreeJson(tree)).digest('hex');
}
