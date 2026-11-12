import { ApiError, type ApiErrorBody } from './types';
import type {
  ApiKeyCreatedDto,
  ApiKeyDto,
  ApiKeyScope,
  AssetDto,
  AuthTokenResponse,
  CourseBranchDto,
  CourseCommitDto,
  CourseDto,
  CourseTreeDto,
  DiffDto,
  EnrollmentDto,
  FormAttemptResultDto,
  LearnerProgressDto,
  MeResponse,
  OrgMemberDto,
  OrganizationDto,
  PathDto,
  PathNodeDto,
  PathProgressDto,
  PathProgressResponse,
  WorkingTreeDto,
} from './types';

const TOKEN_KEY = 'lp_access_token';
const LAST_ORG_KEY = 'lp_last_org_id';

export function getApiBaseUrl(): string {
  // Empty / unset → same-origin (Next rewrites `/v1` to the API). Prefer this when only
  // the web port is exposed (Cursor port forward / Try Live).
  const raw = process.env['NEXT_PUBLIC_API_URL'];
  if (raw === undefined || raw.trim() === '') {
    return '';
  }
  return raw.replace(/\/$/, '');
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function getLastOrgId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(LAST_ORG_KEY);
}

export function setLastOrgId(orgId: string | null): void {
  if (typeof window === 'undefined') return;
  if (orgId) {
    window.localStorage.setItem(LAST_ORG_KEY, orgId);
  } else {
    window.localStorage.removeItem(LAST_ORG_KEY);
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
  formData?: FormData;
};

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}/v1${path.startsWith('/') ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const token = options.token === undefined ? getAccessToken() : options.token;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = options.method ?? (options.body || options.formData ? 'POST' : 'GET');
  let res: Response;
  try {
    if (options.formData) {
      res = await fetch(url, { method, headers, body: options.formData });
    } else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      res = await fetch(url, { method, headers, body: JSON.stringify(options.body) });
    } else {
      res = await fetch(url, { method, headers });
    }
  } catch {
    throw new ApiError(0, null, 'Unable to reach the API. Is the server running?');
  }

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    const errBody =
      data && typeof data === 'object' && 'error' in data ? (data as ApiErrorBody) : null;
    throw new ApiError(res.status, errBody, `Request failed (${res.status})`);
  }

  return data as T;
}

export const api = {
  register(input: { name: string; email: string; password: string }) {
    return apiRequest<AuthTokenResponse>('/auth/register', { method: 'POST', body: input });
  },
  login(input: { email: string; password: string }) {
    return apiRequest<AuthTokenResponse>('/auth/login', { method: 'POST', body: input });
  },
  me(token?: string | null) {
    return apiRequest<MeResponse>('/me', token === undefined ? {} : { token });
  },
  getOrg(orgId: string) {
    return apiRequest<OrganizationDto>(`/orgs/${orgId}`);
  },
  createOrg(input: { name: string; slug: string }) {
    return apiRequest<OrganizationDto>('/orgs', { method: 'POST', body: input });
  },
  listMembers(orgId: string) {
    return apiRequest<OrgMemberDto[]>(`/orgs/${orgId}/members`);
  },
  addMember(orgId: string, input: { email: string; role: string }) {
    return apiRequest<OrgMemberDto>(`/orgs/${orgId}/members`, { method: 'POST', body: input });
  },
  updateMember(orgId: string, userId: string, input: { role: string }) {
    return apiRequest<OrgMemberDto>(`/orgs/${orgId}/members/${userId}`, {
      method: 'PATCH',
      body: input,
    });
  },
  removeMember(orgId: string, userId: string) {
    return apiRequest<void>(`/orgs/${orgId}/members/${userId}`, { method: 'DELETE' });
  },
  listApiKeys(orgId: string) {
    return apiRequest<ApiKeyDto[]>(`/orgs/${orgId}/api-keys`);
  },
  createApiKey(orgId: string, input: { name: string; scopes: ApiKeyScope[] }) {
    return apiRequest<ApiKeyCreatedDto>(`/orgs/${orgId}/api-keys`, {
      method: 'POST',
      body: input,
    });
  },
  revokeApiKey(orgId: string, keyId: string) {
    return apiRequest<void>(`/orgs/${orgId}/api-keys/${keyId}`, { method: 'DELETE' });
  },
  async listCourses(orgId: string) {
    const data = await apiRequest<{ courses: CourseDto[] } | CourseDto[]>(`/orgs/${orgId}/courses`);
    return Array.isArray(data) ? data : data.courses;
  },
  async createCourse(orgId: string, input: { slug: string; title: string; description: string }) {
    const data = await apiRequest<{ course: CourseDto } | CourseDto>(`/orgs/${orgId}/courses`, {
      method: 'POST',
      body: input,
    });
    return 'course' in data ? data.course : data;
  },
  async getCourse(courseId: string) {
    const data = await apiRequest<{ course: CourseDto } | CourseDto>(`/courses/${courseId}`);
    return 'course' in data ? data.course : data;
  },
  async updateCourse(
    courseId: string,
    input: Partial<{ slug: string; title: string; description: string }>,
  ) {
    const data = await apiRequest<{ course: CourseDto } | CourseDto>(`/courses/${courseId}`, {
      method: 'PATCH',
      body: input,
    });
    return 'course' in data ? data.course : data;
  },
  deleteCourse(courseId: string) {
    return apiRequest<void>(`/courses/${courseId}`, { method: 'DELETE' });
  },
  async listBranches(courseId: string) {
    const data = await apiRequest<{ branches: CourseBranchDto[] } | CourseBranchDto[]>(
      `/courses/${courseId}/branches`,
    );
    return Array.isArray(data) ? data : data.branches;
  },
  async createBranch(courseId: string, input: { name: string; from_commit_id: string }) {
    const data = await apiRequest<{ branch: CourseBranchDto } | CourseBranchDto>(
      `/courses/${courseId}/branches`,
      { method: 'POST', body: input },
    );
    return 'branch' in data ? data.branch : data;
  },
  async getBranch(courseId: string, name: string) {
    const data = await apiRequest<{ branch: CourseBranchDto } | CourseBranchDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(name)}`,
    );
    return 'branch' in data ? data.branch : data;
  },
  deleteBranch(courseId: string, name: string) {
    return apiRequest<void>(`/courses/${courseId}/branches/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },
  async getWorkingTree(courseId: string, branchName: string) {
    const data = await apiRequest<{ workingTree: WorkingTreeDto } | WorkingTreeDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/tree`,
    );
    return 'workingTree' in data ? data.workingTree : data;
  },
  async putWorkingTree(courseId: string, branchName: string, tree: CourseTreeDto) {
    const data = await apiRequest<{ workingTree: WorkingTreeDto } | WorkingTreeDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/tree`,
      { method: 'PUT', body: tree },
    );
    return 'workingTree' in data ? data.workingTree : data;
  },
  async patchWorkingTree(courseId: string, branchName: string, ops: unknown[]) {
    const data = await apiRequest<{ workingTree: WorkingTreeDto } | WorkingTreeDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/tree`,
      { method: 'PATCH', body: { ops } },
    );
    return 'workingTree' in data ? data.workingTree : data;
  },
  getDiff(courseId: string, branchName: string) {
    return apiRequest<DiffDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/diff`,
    );
  },
  async commit(courseId: string, branchName: string, input: { message: string }) {
    const data = await apiRequest<{ commit: CourseCommitDto } | CourseCommitDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/commit`,
      { method: 'POST', body: input },
    );
    return 'commit' in data ? data.commit : data;
  },
  async listCommits(courseId: string, branchName?: string) {
    const q = branchName ? `?branch=${encodeURIComponent(branchName)}` : '';
    const data = await apiRequest<{ commits: CourseCommitDto[] } | CourseCommitDto[]>(
      `/courses/${courseId}/commits${q}`,
    );
    return Array.isArray(data) ? data : data.commits;
  },
  async getCommit(courseId: string, commitId: string) {
    const data = await apiRequest<{ commit: CourseCommitDto } | CourseCommitDto>(
      `/courses/${courseId}/commits/${commitId}`,
    );
    return 'commit' in data ? data.commit : data;
  },
  async getCommitTree(courseId: string, commitId: string) {
    const data = await apiRequest<{ snapshot: { tree: CourseTreeDto } } | CourseTreeDto>(
      `/courses/${courseId}/commits/${commitId}/tree`,
    );
    return 'snapshot' in data ? data.snapshot.tree : data;
  },
  async publish(courseId: string, input: { commit_id: string }) {
    const data = await apiRequest<{ course: CourseDto } | CourseDto>(
      `/courses/${courseId}/publish`,
      { method: 'POST', body: input },
    );
    return 'course' in data ? data.course : data;
  },
  async getPublished(courseId: string) {
    const data = await apiRequest<
      CourseTreeDto & { tree?: CourseTreeDto; sections?: CourseTreeDto['sections'] }
    >(`/courses/${courseId}/published`);
    if (data.tree?.sections) return data.tree;
    if (Array.isArray(data.sections)) return { sections: data.sections };
    return data;
  },
  async enroll(courseId: string) {
    const data = await apiRequest<{
      enrollment?: EnrollmentDto;
      progress?: LearnerProgressDto;
      id?: string;
      courseId?: string;
    }>(`/courses/${courseId}/enroll`, { method: 'POST' });
    const enrollment = data.enrollment ?? (data as EnrollmentDto);
    return {
      enrollment,
      progress: data.progress ?? null,
    };
  },
  async getProgress(enrollmentId: string) {
    const data = await apiRequest<
      LearnerProgressDto & {
        progress?: LearnerProgressDto;
        enrollment?: EnrollmentDto;
      }
    >(`/enrollments/${enrollmentId}/progress`);
    const progress = data.progress ?? data;
    return {
      ...progress,
      courseId: progress.courseId ?? data.enrollment?.courseId ?? '',
      enrollmentId: progress.enrollmentId ?? enrollmentId,
    } satisfies LearnerProgressDto;
  },
  async completeSection(enrollmentId: string, sectionId: string) {
    const data = await apiRequest<LearnerProgressDto & { progress?: LearnerProgressDto }>(
      `/enrollments/${enrollmentId}/sections/${sectionId}/complete`,
      { method: 'POST' },
    );
    const progress = data.progress ?? data;
    return {
      ...progress,
      enrollmentId: progress.enrollmentId ?? enrollmentId,
    } satisfies LearnerProgressDto;
  },
  async submitFormAttempt(enrollmentId: string, blockId: string, answers: unknown) {
    const data = await apiRequest<
      FormAttemptResultDto & {
        attempt?: FormAttemptResultDto & { grades?: FormAttemptResultDto['grades'] };
      }
    >(`/enrollments/${enrollmentId}/forms/${blockId}/attempt`, {
      method: 'POST',
      body: { answers },
    });
    const attempt = data.attempt ?? data;
    const result: FormAttemptResultDto = {
      score: attempt.score ?? null,
      passed: attempt.passed ?? null,
      grades: Array.isArray(attempt.grades) ? attempt.grades : [],
      formBlockId: attempt.formBlockId ?? blockId,
    };
    if (attempt.id) result.id = attempt.id;
    return result;
  },
  uploadAsset(orgId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<AssetDto>(`/orgs/${orgId}/assets`, { formData });
  },
  getAsset(assetId: string) {
    return apiRequest<AssetDto>(`/assets/${assetId}`);
  },
  assetContentUrl(assetId: string) {
    return `${getApiBaseUrl()}/v1/assets/${assetId}/content`;
  },
  async listPaths(orgId: string) {
    const data = await apiRequest<{ paths: PathDto[] }>(`/orgs/${orgId}/paths`);
    return data.paths;
  },
  async createPath(orgId: string, input: { slug: string; title: string; description: string }) {
    const data = await apiRequest<{ path: PathDto }>(`/orgs/${orgId}/paths`, {
      method: 'POST',
      body: input,
    });
    return data.path;
  },
  async getPath(pathId: string) {
    const data = await apiRequest<{ path: PathDto }>(`/paths/${pathId}`);
    return data.path;
  },
  async updatePath(
    pathId: string,
    input: Partial<{ slug: string; title: string; description: string }>,
  ) {
    const data = await apiRequest<{ path: PathDto }>(`/paths/${pathId}`, {
      method: 'PATCH',
      body: input,
    });
    return data.path;
  },
  async deletePath(pathId: string) {
    const data = await apiRequest<{ path: PathDto }>(`/paths/${pathId}`, { method: 'DELETE' });
    return data.path;
  },
  async getPathTree(pathId: string) {
    return apiRequest<{ path: PathDto; nodes: PathNodeDto[] }>(`/paths/${pathId}/tree`);
  },
  async putPathTree(
    pathId: string,
    nodes: Array<{
      id?: string;
      parentId: string | null;
      title?: string | null;
      order: number;
      courseId: string;
      sectionId: string;
    }>,
  ) {
    const data = await apiRequest<{ nodes: PathNodeDto[] }>(`/paths/${pathId}/tree`, {
      method: 'PUT',
      body: { nodes },
    });
    return data.nodes;
  },
  async addPathNode(
    pathId: string,
    input: {
      parentId: string | null;
      title?: string | null;
      order?: number;
      courseId: string;
      sectionId: string;
    },
  ) {
    const data = await apiRequest<{ nodes: PathNodeDto[] }>(`/paths/${pathId}/nodes`, {
      method: 'POST',
      body: input,
    });
    return data.nodes;
  },
  async deletePathNode(pathId: string, nodeId: string) {
    const data = await apiRequest<{ nodes: PathNodeDto[] }>(`/paths/${pathId}/nodes/${nodeId}`, {
      method: 'DELETE',
    });
    return data.nodes;
  },
  async enrollPath(pathId: string) {
    return apiRequest<{
      enrollment: { id: string };
      progress: PathProgressDto;
      nodes: PathNodeDto[];
    }>(`/paths/${pathId}/enroll`, { method: 'POST' });
  },
  getPathProgress(enrollmentId: string) {
    return apiRequest<PathProgressResponse>(`/path-enrollments/${enrollmentId}/progress`);
  },
  completePathNode(enrollmentId: string, nodeId: string) {
    return apiRequest<{ progress: PathProgressDto; unlockedNodeIds: string[] }>(
      `/path-enrollments/${enrollmentId}/nodes/${nodeId}/complete`,
      { method: 'POST' },
    );
  },
};
