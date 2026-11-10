import { createHash } from 'node:crypto';

import type { CourseTree } from './types.js';

/**
 * Produce a canonical JSON string for hashing: sorted object keys, stable arrays.
 */
export function canonicalizeTreeJson(tree: CourseTree): string {
  return JSON.stringify(sortKeys(tree));
}

/**
 * SHA-256 hex digest of the canonical course tree JSON.
 */
export function hashCourseTree(tree: CourseTree): string {
  return createHash('sha256').update(canonicalizeTreeJson(tree)).digest('hex');
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      out[key] = sortKeys(record[key]);
    }
    return out;
  }
  return value;
}
