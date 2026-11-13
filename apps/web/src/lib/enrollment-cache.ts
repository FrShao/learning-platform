const KEY = 'lp_enrollment_ids';
const BY_COURSE_KEY = 'lp_enrollment_by_course';
const GLOBAL_BY_COURSE_KEY = 'lp_enrollment_by_course_v2';

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

function readGlobalByCourse(): ByCourseShape {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(GLOBAL_BY_COURSE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as ByCourseShape;
  } catch {
    return {};
  }
}

function writeGlobalByCourse(data: ByCourseShape): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(GLOBAL_BY_COURSE_KEY, JSON.stringify(data));
}

function courseKey(orgId: string | null | undefined, courseId: string): string {
  return `${orgId ?? 'personal'}:${courseId}`;
}

/** Session-local enrollment ids keyed by org (legacy) plus global courseId map. */
export function rememberEnrollment(
  orgId: string | null | undefined,
  enrollmentId: string,
  courseId?: string,
): void {
  const scope = orgId ?? 'personal';
  const data = read();
  const list = data[scope] ?? [];
  if (!list.includes(enrollmentId)) {
    data[scope] = [...list, enrollmentId];
    write(data);
  }
  if (courseId) {
    const byCourse = readByCourse();
    byCourse[courseKey(orgId, courseId)] = enrollmentId;
    writeByCourse(byCourse);

    const global = readGlobalByCourse();
    global[courseId] = enrollmentId;
    writeGlobalByCourse(global);
  }
}

export function listCachedEnrollments(orgId: string): string[] {
  return read()[orgId] ?? [];
}

export function getCachedEnrollmentId(
  orgId: string | null | undefined,
  courseId: string,
): string | null {
  const global = readGlobalByCourse()[courseId];
  if (global) return global;
  return readByCourse()[courseKey(orgId, courseId)] ?? null;
}

export function listCachedCourseEnrollmentIds(): string[] {
  return Object.values(readGlobalByCourse());
}
