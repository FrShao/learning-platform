const ORG_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
 * Return true when a slug matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` and is 2–64 chars.
 */
export function isValidOrgSlug(raw: string): boolean {
  const slug = normalizeOrgSlug(raw);
  return slug.length >= 2 && slug.length <= 64 && ORG_SLUG_RE.test(slug);
}
