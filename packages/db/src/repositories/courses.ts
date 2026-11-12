import {
  DomainError,
  cloneCourseTree,
  emptyCourseTree,
  validateCourseTree,
  type Course,
  type CourseBranch,
  type CourseCommit,
  type CourseSnapshot,
  type CourseTree,
  type CourseWorkingTree,
} from '@lp/domain';
import { hashCourseTree } from '@lp/domain/course-hash';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { Db } from '../client.js';
import {
  mapBranch,
  mapCommit,
  mapCourse,
  mapSnapshot,
  mapWorkingTree,
} from '../mappers/courses.js';
import {
  courseBranches,
  courseCommits,
  courseSnapshots,
  courseWorkingTrees,
  courses,
} from '../schema/courses.js';

export interface CreateCourseInput {
  orgId: string;
  slug: string;
  title: string;
  description: string;
  createdBy: string;
  defaultBranch?: string;
}

export class CourseRepository {
  constructor(private readonly db: Db) {}

  async listByOrg(orgId: string): Promise<Course[]> {
    const rows = await this.db
      .select()
      .from(courses)
      .where(and(eq(courses.orgId, orgId), isNull(courses.deletedAt)))
      .orderBy(desc(courses.updatedAt));
    return rows.map(mapCourse);
  }

  async getById(courseId: string): Promise<Course | null> {
    const rows = await this.db
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
      .limit(1);
    const row = rows[0];
    return row ? mapCourse(row) : null;
  }

  async createCourse(input: CreateCourseInput): Promise<{
    course: Course;
    branch: CourseBranch;
    workingTree: CourseWorkingTree;
  }> {
    const defaultBranch = input.defaultBranch ?? 'main';
    const now = new Date();

    return this.db.transaction(async (tx) => {
      const [courseRow] = await tx
        .insert(courses)
        .values({
          orgId: input.orgId,
          slug: input.slug,
          title: input.title,
          description: input.description,
          defaultBranch,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!courseRow) {
        throw new DomainError('conflict', 'Failed to create course');
      }

      const [branchRow] = await tx
        .insert(courseBranches)
        .values({
          courseId: courseRow.id,
          name: defaultBranch,
          headCommitId: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      if (!branchRow) {
        throw new DomainError('conflict', 'Failed to create default branch');
      }

      const tree = emptyCourseTree();
      const [wtRow] = await tx
        .insert(courseWorkingTrees)
        .values({
          courseId: courseRow.id,
          branchId: branchRow.id,
          baseCommitId: null,
          dirtyTree: tree,
          updatedBy: input.createdBy,
          updatedAt: now,
        })
        .returning();

      if (!wtRow) {
        throw new DomainError('conflict', 'Failed to create working tree');
      }

      return {
        course: mapCourse(courseRow),
        branch: mapBranch(branchRow),
        workingTree: mapWorkingTree(wtRow),
      };
    });
  }

  async updateCourse(
    courseId: string,
    patch: { title?: string; description?: string; slug?: string },
  ): Promise<Course> {
    const updates: Partial<typeof courses.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.slug !== undefined) updates.slug = patch.slug;

    const rows = await this.db
      .update(courses)
      .set(updates)
      .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new DomainError('not_found', 'Course not found');
    }
    return mapCourse(row);
  }

  async softDeleteCourse(courseId: string): Promise<Course> {
    const rows = await this.db
      .update(courses)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new DomainError('not_found', 'Course not found');
    }
    return mapCourse(row);
  }

  async listBranches(courseId: string): Promise<CourseBranch[]> {
    const rows = await this.db
      .select()
      .from(courseBranches)
      .where(eq(courseBranches.courseId, courseId))
      .orderBy(courseBranches.name);
    return rows.map(mapBranch);
  }

  async getBranchByName(courseId: string, name: string): Promise<CourseBranch | null> {
    const rows = await this.db
      .select()
      .from(courseBranches)
      .where(and(eq(courseBranches.courseId, courseId), eq(courseBranches.name, name)))
      .limit(1);
    const row = rows[0];
    return row ? mapBranch(row) : null;
  }

  async createBranch(
    courseId: string,
    name: string,
    fromCommitId: string | null,
  ): Promise<CourseBranch> {
    const course = await this.requireCourse(courseId);
    if (fromCommitId) {
      await this.requireCommit(courseId, fromCommitId);
    }

    const now = new Date();
    try {
      const [row] = await this.db
        .insert(courseBranches)
        .values({
          courseId: course.id,
          name,
          headCommitId: fromCommitId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!row) {
        throw new DomainError('conflict', 'Failed to create branch');
      }
      return mapBranch(row);
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new DomainError('conflict', `Branch already exists: ${name}`);
      }
      throw err;
    }
  }

  async deleteBranch(courseId: string, name: string): Promise<void> {
    const course = await this.requireCourse(courseId);
    if (name === course.defaultBranch) {
      throw new DomainError('conflict', 'Cannot delete the default branch');
    }
    const branch = await this.getBranchByName(courseId, name);
    if (!branch) {
      throw new DomainError('not_found', `Branch not found: ${name}`);
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(courseWorkingTrees)
        .where(
          and(
            eq(courseWorkingTrees.courseId, courseId),
            eq(courseWorkingTrees.branchId, branch.id),
          ),
        );
      await tx.delete(courseBranches).where(eq(courseBranches.id, branch.id));
    });
  }

  async ensureWorkingTree(
    courseId: string,
    branchName: string,
    actorUserId: string,
  ): Promise<CourseWorkingTree> {
    const branch = await this.requireBranch(courseId, branchName);
    const existing = await this.getWorkingTree(courseId, branch.id);
    if (existing) {
      return existing;
    }

    let dirtyTree = emptyCourseTree();
    if (branch.headCommitId) {
      const snapshot = await this.getSnapshotForCommit(branch.headCommitId);
      dirtyTree = cloneCourseTree(snapshot.tree);
    }

    const now = new Date();
    const [row] = await this.db
      .insert(courseWorkingTrees)
      .values({
        courseId,
        branchId: branch.id,
        baseCommitId: branch.headCommitId,
        dirtyTree,
        updatedBy: actorUserId,
        updatedAt: now,
      })
      .returning();

    if (!row) {
      throw new DomainError('conflict', 'Failed to create working tree');
    }
    return mapWorkingTree(row);
  }

  async getWorkingTree(courseId: string, branchId: string): Promise<CourseWorkingTree | null> {
    const rows = await this.db
      .select()
      .from(courseWorkingTrees)
      .where(
        and(eq(courseWorkingTrees.courseId, courseId), eq(courseWorkingTrees.branchId, branchId)),
      )
      .limit(1);
    const row = rows[0];
    return row ? mapWorkingTree(row) : null;
  }

  async replaceWorkingTree(
    courseId: string,
    branchName: string,
    dirtyTree: CourseTree,
    actorUserId: string,
  ): Promise<CourseWorkingTree> {
    validateCourseTree(dirtyTree);
    const branch = await this.requireBranch(courseId, branchName);
    await this.ensureWorkingTree(courseId, branchName, actorUserId);

    const [row] = await this.db
      .update(courseWorkingTrees)
      .set({
        dirtyTree,
        updatedBy: actorUserId,
        updatedAt: new Date(),
      })
      .where(
        and(eq(courseWorkingTrees.courseId, courseId), eq(courseWorkingTrees.branchId, branch.id)),
      )
      .returning();

    if (!row) {
      throw new DomainError('not_found', 'Working tree not found');
    }
    return mapWorkingTree(row);
  }

  async getBaseTreeForWorkingTree(workingTree: CourseWorkingTree): Promise<CourseTree | null> {
    if (!workingTree.baseCommitId) {
      return null;
    }
    const snapshot = await this.getSnapshotForCommit(workingTree.baseCommitId);
    return snapshot.tree;
  }

  async commitBranch(
    courseId: string,
    branchName: string,
    message: string,
    authorId: string,
  ): Promise<{ commit: CourseCommit; snapshot: CourseSnapshot; branch: CourseBranch }> {
    const branch = await this.requireBranch(courseId, branchName);
    const workingTree = await this.ensureWorkingTree(courseId, branchName, authorId);
    validateCourseTree(workingTree.dirtyTree);

    const contentHash = hashCourseTree(workingTree.dirtyTree);
    const parentIds = branch.headCommitId ? [branch.headCommitId] : [];
    const now = new Date();

    return this.db.transaction(async (tx) => {
      let snapshotRow = (
        await tx
          .select()
          .from(courseSnapshots)
          .where(eq(courseSnapshots.contentHash, contentHash))
          .limit(1)
      )[0];

      if (!snapshotRow) {
        const inserted = await tx
          .insert(courseSnapshots)
          .values({
            tree: workingTree.dirtyTree,
            contentHash,
            createdAt: now,
          })
          .returning();
        snapshotRow = inserted[0];
      }

      if (!snapshotRow) {
        throw new DomainError('conflict', 'Failed to create snapshot');
      }

      const [commitRow] = await tx
        .insert(courseCommits)
        .values({
          courseId,
          branchIdAtCreate: branch.id,
          parentIds,
          message,
          authorId,
          snapshotId: snapshotRow.id,
          createdAt: now,
        })
        .returning();

      if (!commitRow) {
        throw new DomainError('conflict', 'Failed to create commit');
      }

      const [branchRow] = await tx
        .update(courseBranches)
        .set({ headCommitId: commitRow.id, updatedAt: now })
        .where(eq(courseBranches.id, branch.id))
        .returning();

      if (!branchRow) {
        throw new DomainError('conflict', 'Failed to advance branch head');
      }

      await tx
        .update(courseWorkingTrees)
        .set({
          baseCommitId: commitRow.id,
          dirtyTree: workingTree.dirtyTree,
          updatedBy: authorId,
          updatedAt: now,
        })
        .where(
          and(
            eq(courseWorkingTrees.courseId, courseId),
            eq(courseWorkingTrees.branchId, branch.id),
          ),
        );

      return {
        commit: mapCommit(commitRow),
        snapshot: mapSnapshot(snapshotRow),
        branch: mapBranch(branchRow),
      };
    });
  }

  async listCommits(courseId: string, branchName?: string): Promise<CourseCommit[]> {
    if (!branchName) {
      const rows = await this.db
        .select()
        .from(courseCommits)
        .where(eq(courseCommits.courseId, courseId))
        .orderBy(desc(courseCommits.createdAt));
      return rows.map(mapCommit);
    }

    const branch = await this.requireBranch(courseId, branchName);
    if (!branch.headCommitId) {
      return [];
    }

    // Walk parent chain from head (linear history in v1).
    const byId = new Map<string, CourseCommit>();
    const all = await this.db
      .select()
      .from(courseCommits)
      .where(eq(courseCommits.courseId, courseId));
    for (const row of all) {
      byId.set(row.id, mapCommit(row));
    }

    const history: CourseCommit[] = [];
    const seen = new Set<string>();
    let current: string | null = branch.headCommitId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const commit = byId.get(current);
      if (!commit) break;
      history.push(commit);
      current = commit.parentIds[0] ?? null;
    }
    return history;
  }

  async getCommit(courseId: string, commitId: string): Promise<CourseCommit | null> {
    const rows = await this.db
      .select()
      .from(courseCommits)
      .where(and(eq(courseCommits.courseId, courseId), eq(courseCommits.id, commitId)))
      .limit(1);
    const row = rows[0];
    return row ? mapCommit(row) : null;
  }

  async getCommitTree(courseId: string, commitId: string): Promise<CourseSnapshot> {
    const commit = await this.requireCommit(courseId, commitId);
    return this.getSnapshot(commit.snapshotId);
  }

  async publish(courseId: string, commitId: string): Promise<Course> {
    await this.requireCommit(courseId, commitId);
    const rows = await this.db
      .update(courses)
      .set({ publishedCommitId: commitId, updatedAt: new Date() })
      .where(and(eq(courses.id, courseId), isNull(courses.deletedAt)))
      .returning();
    const row = rows[0];
    if (!row) {
      throw new DomainError('not_found', 'Course not found');
    }
    return mapCourse(row);
  }

  async getSnapshotForCommit(commitId: string): Promise<CourseSnapshot> {
    const commitRows = await this.db
      .select()
      .from(courseCommits)
      .where(eq(courseCommits.id, commitId))
      .limit(1);
    const commit = commitRows[0];
    if (!commit) {
      throw new DomainError('not_found', `Commit not found: ${commitId}`);
    }
    return this.getSnapshot(commit.snapshotId);
  }

  private async getSnapshot(snapshotId: string): Promise<CourseSnapshot> {
    const rows = await this.db
      .select()
      .from(courseSnapshots)
      .where(eq(courseSnapshots.id, snapshotId))
      .limit(1);
    const row = rows[0];
    if (!row) {
      throw new DomainError('not_found', `Snapshot not found: ${snapshotId}`);
    }
    return mapSnapshot(row);
  }

  private async requireCourse(courseId: string): Promise<Course> {
    const course = await this.getById(courseId);
    if (!course) {
      throw new DomainError('not_found', 'Course not found');
    }
    return course;
  }

  private async requireBranch(courseId: string, name: string): Promise<CourseBranch> {
    await this.requireCourse(courseId);
    const branch = await this.getBranchByName(courseId, name);
    if (!branch) {
      throw new DomainError('not_found', `Branch not found: ${name}`);
    }
    return branch;
  }

  private async requireCommit(courseId: string, commitId: string): Promise<CourseCommit> {
    const commit = await this.getCommit(courseId, commitId);
    if (!commit) {
      throw new DomainError('not_found', `Commit not found: ${commitId}`);
    }
    return commit;
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

/** Ensure gen_random_uuid is available (pgcrypto / built-in on PG13+). */
export async function ensurePostgresExtensions(db: Db): Promise<void> {
  await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
}
