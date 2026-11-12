const KEY = 'lp_path_enrollments';

type Cache = Record<string, string>;

function read(): Cache {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Cache;
  } catch {
    return {};
  }
}

function write(cache: Cache): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(cache));
}

export function getCachedPathEnrollmentId(pathId: string): string | null {
  return read()[pathId] ?? null;
}

export function setCachedPathEnrollmentId(pathId: string, enrollmentId: string): void {
  const cache = read();
  cache[pathId] = enrollmentId;
  write(cache);
}
