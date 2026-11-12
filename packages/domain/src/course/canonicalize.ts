import type { CourseTree } from './types.js';

/**
 * Produce a canonical JSON string for hashing: sorted object keys, stable arrays.
 * Pure (no Node crypto) — safe for browser bundles.
 */
export function canonicalizeTreeJson(tree: CourseTree): string {
  return JSON.stringify(sortKeys(tree));
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
