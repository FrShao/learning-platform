const KEY = 'lp_enrollment_ids';
const BY_COURSE_KEY = 'lp_enrollment_by_course';

type CacheShape = Record<string, string[]>;
type ByCourseShape = Record<string, string>;

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

function readByCourse(): ByCourseShape {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(BY_COURSE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ByCourseShape;
  } catch {
    return {};
  }
}

function writeByCourse(data: ByCourseShape): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(BY_COURSE_KEY, JSON.stringify(data));
}

function courseKey(orgId: string, courseId: string): string {
  return `${orgId}:${courseId}`;
}

/** Session-local enrollment ids keyed by org (API has no list-enrollments endpoint yet). */
export function rememberEnrollment(orgId: string, enrollmentId: string, courseId?: string): void {
  const data = read();
  const list = data[orgId] ?? [];
  if (!list.includes(enrollmentId)) {
    data[orgId] = [...list, enrollmentId];
    write(data);
  }
  if (courseId) {
    const byCourse = readByCourse();
    byCourse[courseKey(orgId, courseId)] = enrollmentId;
    writeByCourse(byCourse);
  }
}

export function listCachedEnrollments(orgId: string): string[] {
  return read()[orgId] ?? [];
}

export function getCachedEnrollmentId(orgId: string, courseId: string): string | null {
  return readByCourse()[courseKey(orgId, courseId)] ?? null;
}
