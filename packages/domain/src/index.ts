/** Canonical domain types and pure helpers. See docs/domain-object-models.md. */

export type OrgId = string;
export type CourseId = string;
export type UserId = string;

export type OrgRole = 'owner' | 'admin' | 'author' | 'learner';

export interface Organization {
  id: OrgId;
  slug: string;
  name: string;
  createdAt: Date;
}

/**
 * Normalize an organization slug: lowercase, trim, collapse internal whitespace to hyphens.
 */
export function normalizeOrgSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Return true when a slug is non-empty after normalization.
 */
export function isValidOrgSlug(raw: string): boolean {
  const slug = normalizeOrgSlug(raw);
  return slug.length >= 2 && slug.length <= 64;
}
