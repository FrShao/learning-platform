const KEY = 'lp_enrollment_ids';

type CacheShape = Record<string, string[]>;

function read(): CacheShape {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as CacheShape;
  } catch {
    return {};
  }
}

function write(data: CacheShape): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

/** Session-local enrollment ids keyed by org (API has no list-enrollments endpoint yet). */
export function rememberEnrollment(orgId: string, enrollmentId: string): void {
  const data = read();
  const list = data[orgId] ?? [];
  if (!list.includes(enrollmentId)) {
    data[orgId] = [...list, enrollmentId];
    write(data);
  }
}

export function listCachedEnrollments(orgId: string): string[] {
  return read()[orgId] ?? [];
}
