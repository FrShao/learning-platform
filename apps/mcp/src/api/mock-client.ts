import type { LearningPlatformApi } from './client.js';
import type { CreateBranchBody, CreateCourseBody, TreeOp, UploadAssetBody } from './types.js';

export interface MockApiCall {
  method: keyof LearningPlatformApi;
  args: unknown[];
}

/**
 * In-memory API stub for unit tests (no network).
 */
export function createMockApiClient(overrides: Partial<LearningPlatformApi> = {}): {
  api: LearningPlatformApi;
  calls: MockApiCall[];
} {
  const calls: MockApiCall[] = [];

  const record =
    <K extends keyof LearningPlatformApi>(method: K, impl: LearningPlatformApi[K]) =>
    (...args: Parameters<LearningPlatformApi[K]>) => {
      calls.push({ method, args });
      return (impl as (...a: unknown[]) => ReturnType<LearningPlatformApi[K]>)(...args);
    };

  const base: LearningPlatformApi = {
    listCourses: async (orgId: string) => ({ org_id: orgId, courses: [] }),
    getCourse: async (courseId: string) => ({ id: courseId, title: 'Mock' }),
    getCourseBranches: async (courseId: string) => ({
      course_id: courseId,
      branches: [{ name: 'main', head_commit_id: 'c0' }],
    }),
    createCourse: async (orgId: string, body: CreateCourseBody) => ({
      id: 'course_1',
      org_id: orgId,
      ...body,
    }),
    checkoutBranch: async (courseId: string, branch: string) => ({
      course_id: courseId,
      branch,
      tree: { sections: [] },
    }),
    getWorkingTree: async (courseId: string, branch: string) => ({
      course_id: courseId,
      branch,
      tree: { sections: [] },
    }),
    applyTreeOps: async (courseId: string, branch: string, ops: TreeOp[]) => ({
      course_id: courseId,
      branch,
      applied: ops.length,
      ops,
    }),
    commitCourse: async (courseId: string, branch: string, message: string) => ({
      id: 'commit_1',
      course_id: courseId,
      branch,
      message,
    }),
    createBranch: async (courseId: string, body: CreateBranchBody) => ({
      course_id: courseId,
      ...body,
    }),
    publishCourse: async (courseId: string, commitId: string) => ({
      course_id: courseId,
      published_commit_id: commitId,
    }),
    uploadAsset: async (orgId: string, body: UploadAssetBody) => ({
      id: 'asset_1',
      org_id: orgId,
      url: body.url ?? `https://assets.example/${body.filename}`,
      stub: true,
    }),
  };

  const api: LearningPlatformApi = {
    listCourses: record('listCourses', overrides.listCourses ?? base.listCourses),
    getCourse: record('getCourse', overrides.getCourse ?? base.getCourse),
    getCourseBranches: record(
      'getCourseBranches',
      overrides.getCourseBranches ?? base.getCourseBranches,
    ),
    createCourse: record('createCourse', overrides.createCourse ?? base.createCourse),
    checkoutBranch: record('checkoutBranch', overrides.checkoutBranch ?? base.checkoutBranch),
    getWorkingTree: record('getWorkingTree', overrides.getWorkingTree ?? base.getWorkingTree),
    applyTreeOps: record('applyTreeOps', overrides.applyTreeOps ?? base.applyTreeOps),
    commitCourse: record('commitCourse', overrides.commitCourse ?? base.commitCourse),
    createBranch: record('createBranch', overrides.createBranch ?? base.createBranch),
    publishCourse: record('publishCourse', overrides.publishCourse ?? base.publishCourse),
    uploadAsset: record('uploadAsset', overrides.uploadAsset ?? base.uploadAsset),
  };

  return { api, calls };
}
