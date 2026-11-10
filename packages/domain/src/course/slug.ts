const COURSE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCH_NAME_RE = /^[a-zA-Z0-9._/-]+$/;

/**
 * Normalize a course slug: lowercase, trim, collapse whitespace to hyphens.
 */
export function normalizeCourseSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Return true when a course slug matches org-style URL-safe rules (2–64 chars).
 */
export function isValidCourseSlug(raw: string): boolean {
  const slug = normalizeCourseSlug(raw);
  return slug.length >= 2 && slug.length <= 64 && COURSE_SLUG_RE.test(slug);
}

/**
 * Return true when a branch name is allowed (1–128, no leading/trailing `/`).
 */
export function isValidBranchName(name: string): boolean {
  if (name.length < 1 || name.length > 128) {
    return false;
  }
  if (name.startsWith('/') || name.endsWith('/')) {
    return false;
  }
  return BRANCH_NAME_RE.test(name);
}
