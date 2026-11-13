import { CourseRepository, type Db } from '@lp/db';
import {
  DomainError,
  applyTreePatch,
  diffCourseTrees,
  isValidBranchName,
  isValidCourseSlug,
  normalizeCourseSlug,
  validateCourseTree,
  type Course,
  type CourseBranch,
  type CourseCommit,
  type CourseSnapshot,
  type CourseTree,
  type CourseWorkingTree,
  type TreeDiff,
  type TreePatch,
} from '@lp/domain';

export class CourseService {
  private readonly repo: CourseRepository;

  constructor(db: Db) {
    this.repo = new CourseRepository(db);
  }

  listCourses(orgId: string): Promise<Course[]> {
    return this.repo.listByOrg(orgId);
  }

  listPersonalCourses(ownerUserId: string): Promise<Course[]> {
    return this.repo.listByOwnerUser(ownerUserId);
  }

  listPublishedUserOwnedCourses(): Promise<Course[]> {
    return this.repo.listPublishedUserOwned();
  }

  async getCourse(courseId: string): Promise<Course> {
    const course = await this.repo.getById(courseId);
    if (!course) {
      throw new DomainError('not_found', 'Course not found');
    }
    return course;
  }

  async createCourse(input: {
    orgId?: string | null;
    ownerUserId?: string | null;
    slug: string;
    title: string;
    description?: string;
    createdBy: string;
  }): Promise<{ course: Course; branch: CourseBranch }> {
    const slug = normalizeCourseSlug(input.slug);
    if (!isValidCourseSlug(slug)) {
      throw new DomainError('validation', 'Invalid course slug');
    }
    if (!input.title || input.title.trim().length < 1 || input.title.length > 200) {
      throw new DomainError('validation', 'Title must be 1–200 characters');
    }

    const orgId = input.orgId ?? null;
    const ownerUserId = input.ownerUserId ?? null;
    if ((orgId == null) === (ownerUserId == null)) {
      throw new DomainError(
        'validation',
        'Course ownership requires exactly one of orgId or ownerUserId',
      );
    }

    try {
      const created = await this.repo.createCourse({
        orgId,
        ownerUserId,
        slug,
        title: input.title.trim(),
        description: input.description ?? '',
        createdBy: input.createdBy,
      });
      return { course: created.course, branch: created.branch };
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DomainError('conflict', `Course slug already exists: ${slug}`);
      }
      throw err;
    }
  }

  async updateCourse(
    courseId: string,
    patch: { title?: string; description?: string; slug?: string },
  ): Promise<Course> {
    const normalized: { title?: string; description?: string; slug?: string } = {};
    if (patch.title !== undefined) {
      if (patch.title.trim().length < 1 || patch.title.length > 200) {
        throw new DomainError('validation', 'Title must be 1–200 characters');
      }
      normalized.title = patch.title.trim();
    }
    if (patch.description !== undefined) {
      normalized.description = patch.description;
    }
    if (patch.slug !== undefined) {
      const slug = normalizeCourseSlug(patch.slug);
      if (!isValidCourseSlug(slug)) {
        throw new DomainError('validation', 'Invalid course slug');
      }
      normalized.slug = slug;
    }
    try {
      return await this.repo.updateCourse(courseId, normalized);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DomainError('conflict', 'Course slug already exists');
      }
      throw err;
    }
  }

  softDeleteCourse(courseId: string): Promise<Course> {
    return this.repo.softDeleteCourse(courseId);
  }

  listBranches(courseId: string): Promise<CourseBranch[]> {
    return this.repo.listBranches(courseId);
  }

  async getBranch(courseId: string, name: string): Promise<CourseBranch> {
    const branch = await this.repo.getBranchByName(courseId, name);
    if (!branch) {
      throw new DomainError('not_found', `Branch not found: ${name}`);
    }
    return branch;
  }

  async createBranch(
    courseId: string,
    name: string,
    fromCommitId: string | null,
  ): Promise<CourseBranch> {
    if (!isValidBranchName(name)) {
      throw new DomainError('validation', 'Invalid branch name');
    }
    return this.repo.createBranch(courseId, name, fromCommitId);
  }

  deleteBranch(courseId: string, name: string): Promise<void> {
    return this.repo.deleteBranch(courseId, name);
  }

  getWorkingTree(courseId: string, branchName: string, userId: string): Promise<CourseWorkingTree> {
    return this.repo.ensureWorkingTree(courseId, branchName, userId);
  }

  putWorkingTree(
    courseId: string,
    branchName: string,
    tree: CourseTree,
    userId: string,
  ): Promise<CourseWorkingTree> {
    validateCourseTree(tree);
    return this.repo.replaceWorkingTree(courseId, branchName, tree, userId);
  }

  async patchWorkingTree(
    courseId: string,
    branchName: string,
    patch: TreePatch,
    userId: string,
  ): Promise<CourseWorkingTree> {
    const current = await this.repo.ensureWorkingTree(courseId, branchName, userId);
    const next = applyTreePatch(current.dirtyTree, patch);
    return this.repo.replaceWorkingTree(courseId, branchName, next, userId);
  }

  async diffWorkingTree(
    courseId: string,
    branchName: string,
    userId: string,
  ): Promise<{ baseCommitId: string | null; diff: TreeDiff }> {
    const workingTree = await this.repo.ensureWorkingTree(courseId, branchName, userId);
    const baseTree = await this.repo.getBaseTreeForWorkingTree(workingTree);
    return {
      baseCommitId: workingTree.baseCommitId,
      diff: diffCourseTrees(baseTree, workingTree.dirtyTree),
    };
  }

  commit(
    courseId: string,
    branchName: string,
    message: string,
    authorId: string,
  ): Promise<{ commit: CourseCommit; snapshot: CourseSnapshot; branch: CourseBranch }> {
    const trimmed = message.trim();
    if (trimmed.length < 1 || trimmed.length > 2000) {
      throw new DomainError('validation', 'Commit message must be 1–2000 characters');
    }
    return this.repo.commitBranch(courseId, branchName, trimmed, authorId);
  }

  listCommits(courseId: string, branchName?: string): Promise<CourseCommit[]> {
    return this.repo.listCommits(courseId, branchName);
  }

  async getCommit(courseId: string, commitId: string): Promise<CourseCommit> {
    const commit = await this.repo.getCommit(courseId, commitId);
    if (!commit) {
      throw new DomainError('not_found', `Commit not found: ${commitId}`);
    }
    return commit;
  }

  getCommitTree(courseId: string, commitId: string): Promise<CourseSnapshot> {
    return this.repo.getCommitTree(courseId, commitId);
  }

  publish(courseId: string, commitId: string): Promise<Course> {
    return this.repo.publish(courseId, commitId);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  );
}
