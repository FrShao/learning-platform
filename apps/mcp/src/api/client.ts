import {
  ApiClientError,
  type ApplyTreeOpsBody,
  type ApiErrorBody,
  type CommitBody,
  type CreateBranchBody,
  type CreateCourseBody,
  type PublishBody,
  type TreeOp,
  type UploadAssetBody,
} from './types.js';

export interface LearningPlatformApi {
  listCourses(orgId: string): Promise<unknown>;
  getCourse(courseId: string): Promise<unknown>;
  getCourseBranches(courseId: string): Promise<unknown>;
  createCourse(orgId: string, body: CreateCourseBody): Promise<unknown>;
  checkoutBranch(courseId: string, branch: string): Promise<unknown>;
  getWorkingTree(courseId: string, branch: string): Promise<unknown>;
  applyTreeOps(courseId: string, branch: string, ops: TreeOp[]): Promise<unknown>;
  commitCourse(courseId: string, branch: string, message: string): Promise<unknown>;
  createBranch(courseId: string, body: CreateBranchBody): Promise<unknown>;
  publishCourse(courseId: string, commitId: string): Promise<unknown>;
  uploadAsset(orgId: string, body: UploadAssetBody): Promise<unknown>;
}

export interface HttpClientOptions {
  apiBaseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

function encodePathSegment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * HTTP client for Learning Platform `/v1` authoring routes.
 * Authenticates with `X-Api-Key` per plan §5 / screens auth note.
 */
export function createHttpApiClient(options: HttpClientOptions): LearningPlatformApi {
  const fetchImpl = options.fetchImpl ?? fetch;
  const base = options.apiBaseUrl.replace(/\/+$/, '');

  async function request(method: string, path: string, body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-api-key': options.apiKey,
    };

    const init: {
      method: string;
      headers: Record<string, string>;
      body?: string;
    } = { method, headers };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    const res = await fetchImpl(`${base}${path}`, init);

    const text = await res.text();
    let data: unknown = undefined;
    if (text.length > 0) {
      try {
        data = JSON.parse(text) as unknown;
      } catch {
        data = { raw: text };
      }
    }

    if (!res.ok) {
      const errBody = data as ApiErrorBody | undefined;
      const code = errBody?.error?.code ?? 'http_error';
      const message = errBody?.error?.message ?? `HTTP ${res.status} ${method} ${path}`;
      throw new ApiClientError(res.status, code, message, errBody?.error?.details);
    }

    return data;
  }

  return {
    listCourses(orgId) {
      return request('GET', `/v1/orgs/${encodePathSegment(orgId)}/courses`);
    },
    getCourse(courseId) {
      return request('GET', `/v1/courses/${encodePathSegment(courseId)}`);
    },
    getCourseBranches(courseId) {
      return request('GET', `/v1/courses/${encodePathSegment(courseId)}/branches`);
    },
    createCourse(orgId, body) {
      return request('POST', `/v1/orgs/${encodePathSegment(orgId)}/courses`, body);
    },
    checkoutBranch(courseId, branch) {
      // GET tree creates the working tree when missing (plan §5.4).
      return request(
        'GET',
        `/v1/courses/${encodePathSegment(courseId)}/branches/${encodePathSegment(branch)}/tree`,
      );
    },
    getWorkingTree(courseId, branch) {
      return request(
        'GET',
        `/v1/courses/${encodePathSegment(courseId)}/branches/${encodePathSegment(branch)}/tree`,
      );
    },
    applyTreeOps(courseId, branch, ops) {
      const body: ApplyTreeOpsBody = { ops };
      return request(
        'PATCH',
        `/v1/courses/${encodePathSegment(courseId)}/branches/${encodePathSegment(branch)}/tree`,
        body,
      );
    },
    commitCourse(courseId, branch, message) {
      const body: CommitBody = { message };
      return request(
        'POST',
        `/v1/courses/${encodePathSegment(courseId)}/branches/${encodePathSegment(branch)}/commit`,
        body,
      );
    },
    createBranch(courseId, body: CreateBranchBody) {
      return request('POST', `/v1/courses/${encodePathSegment(courseId)}/branches`, body);
    },
    publishCourse(courseId, commitId) {
      const body: PublishBody = { commit_id: commitId };
      return request('POST', `/v1/courses/${encodePathSegment(courseId)}/publish`, body);
    },
    uploadAsset(orgId, body) {
      // JSON stub for multipart upload; accepts bytes (base64) or URL ingest.
      return request('POST', `/v1/orgs/${encodePathSegment(orgId)}/assets`, body);
    },
  };
}
