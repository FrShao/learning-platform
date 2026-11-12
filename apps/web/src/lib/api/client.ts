import { ApiError, type ApiErrorBody } from './types';
import type {
  ApiKeyCreatedDto,
  ApiKeyDto,
  ApiKeyScope,
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
  const raw = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';
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
  listCourses(orgId: string) {
    return apiRequest<CourseDto[]>(`/orgs/${orgId}/courses`);
  },
  createCourse(orgId: string, input: { slug: string; title: string; description: string }) {
    return apiRequest<CourseDto>(`/orgs/${orgId}/courses`, { method: 'POST', body: input });
  },
  getCourse(courseId: string) {
    return apiRequest<CourseDto>(`/courses/${courseId}`);
  },
  updateCourse(
    courseId: string,
    input: Partial<{ slug: string; title: string; description: string }>,
  ) {
    return apiRequest<CourseDto>(`/courses/${courseId}`, { method: 'PATCH', body: input });
  },
  deleteCourse(courseId: string) {
    return apiRequest<void>(`/courses/${courseId}`, { method: 'DELETE' });
  },
  listBranches(courseId: string) {
    return apiRequest<CourseBranchDto[]>(`/courses/${courseId}/branches`);
  },
  createBranch(courseId: string, input: { name: string; from_commit_id: string }) {
    return apiRequest<CourseBranchDto>(`/courses/${courseId}/branches`, {
      method: 'POST',
      body: input,
    });
  },
  getBranch(courseId: string, name: string) {
    return apiRequest<CourseBranchDto>(`/courses/${courseId}/branches/${encodeURIComponent(name)}`);
  },
  deleteBranch(courseId: string, name: string) {
    return apiRequest<void>(`/courses/${courseId}/branches/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
  },
  getWorkingTree(courseId: string, branchName: string) {
    return apiRequest<WorkingTreeDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/tree`,
    );
  },
  putWorkingTree(courseId: string, branchName: string, tree: CourseTreeDto) {
    return apiRequest<WorkingTreeDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/tree`,
      { method: 'PUT', body: tree },
    );
  },
  patchWorkingTree(courseId: string, branchName: string, ops: unknown[]) {
    return apiRequest<WorkingTreeDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/tree`,
      { method: 'PATCH', body: { ops } },
    );
  },
  getDiff(courseId: string, branchName: string) {
    return apiRequest<DiffDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/diff`,
    );
  },
  commit(courseId: string, branchName: string, input: { message: string }) {
    return apiRequest<CourseCommitDto>(
      `/courses/${courseId}/branches/${encodeURIComponent(branchName)}/commit`,
      { method: 'POST', body: input },
    );
  },
  listCommits(courseId: string, branchName?: string) {
    const q = branchName ? `?branch=${encodeURIComponent(branchName)}` : '';
    return apiRequest<CourseCommitDto[]>(`/courses/${courseId}/commits${q}`);
  },
  getCommit(courseId: string, commitId: string) {
    return apiRequest<CourseCommitDto>(`/courses/${courseId}/commits/${commitId}`);
  },
  getCommitTree(courseId: string, commitId: string) {
    return apiRequest<CourseTreeDto>(`/courses/${courseId}/commits/${commitId}/tree`);
  },
  publish(courseId: string, input: { commit_id: string }) {
    return apiRequest<CourseDto>(`/courses/${courseId}/publish`, { method: 'POST', body: input });
  },
  getPublished(courseId: string) {
    return apiRequest<CourseTreeDto>(`/courses/${courseId}/published`);
  },
  enroll(courseId: string) {
    return apiRequest<EnrollmentDto>(`/courses/${courseId}/enroll`, { method: 'POST' });
  },
  getProgress(enrollmentId: string) {
    return apiRequest<LearnerProgressDto>(`/enrollments/${enrollmentId}/progress`);
  },
  completeSection(enrollmentId: string, sectionId: string) {
    return apiRequest<LearnerProgressDto>(
      `/enrollments/${enrollmentId}/sections/${sectionId}/complete`,
      { method: 'POST' },
    );
  },
  submitFormAttempt(enrollmentId: string, blockId: string, answers: unknown) {
    return apiRequest<FormAttemptResultDto>(
      `/enrollments/${enrollmentId}/forms/${blockId}/attempt`,
      { method: 'POST', body: { answers } },
    );
  },
  uploadAsset(orgId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiRequest<{ id: string; url: string }>(`/orgs/${orgId}/assets`, { formData });
  },
  getAsset(assetId: string) {
    return apiRequest<{ id: string; url: string }>(`/assets/${assetId}`);
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
