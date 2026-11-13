import { listMembershipsForUser } from '@lp/db';
import type { FastifyInstance } from 'fastify';

import { requireJwtUser } from '../auth/require-user.js';
import { serializeUser } from '../serialize.js';

function serializeCourse(course: {
  id: string;
  owner: unknown;
  orgId: string | null;
  ownerUserId: string | null;
  slug: string;
  title: string;
  description: string;
  defaultBranch: string;
  publishedCommitId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: course.id,
    owner: course.owner,
    orgId: course.orgId,
    ownerUserId: course.ownerUserId,
    slug: course.slug,
    title: course.title,
    description: course.description,
    defaultBranch: course.defaultBranch,
    publishedCommitId: course.publishedCommitId,
    createdBy: course.createdBy,
    createdAt: course.createdAt.toISOString(),
    updatedAt: course.updatedAt.toISOString(),
    deletedAt: course.deletedAt ? course.deletedAt.toISOString() : null,
  };
}

function serializePath(path: {
  id: string;
  owner: unknown;
  orgId: string | null;
  ownerUserId: string | null;
  slug: string;
  title: string;
  description: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}) {
  return {
    id: path.id,
    owner: path.owner,
    orgId: path.orgId,
    ownerUserId: path.ownerUserId,
    slug: path.slug,
    title: path.title,
    description: path.description,
    createdBy: path.createdBy,
    createdAt: path.createdAt.toISOString(),
    updatedAt: path.updatedAt.toISOString(),
    deletedAt: path.deletedAt ? path.deletedAt.toISOString() : null,
  };
}

export async function registerMeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/me', async (request) => {
    const user = requireJwtUser(request);
    const me = await app.authService.getMe(user);
    return {
      user: {
        ...serializeUser(user),
      },
      memberships: me.memberships.map((m) => ({
        orgId: m.orgId,
        role: m.role,
        org: m.org,
      })),
    };
  });

  /**
   * Learnable catalog for the signed-in user:
   * - published user-owned courses/paths (public to any authenticated learner)
   * - published org-owned courses + org paths for memberships
   */
  app.get('/v1/me/catalog', async (request) => {
    const user = requireJwtUser(request);
    const memberships = await listMembershipsForUser(app.dbClient.db, user.id);

    const [publicCourses, publicPaths, ...orgBundles] = await Promise.all([
      app.courseService.listPublishedUserOwnedCourses(),
      app.pathService.listUserOwnedPaths(),
      ...memberships.map(async (m) => {
        const [courses, paths] = await Promise.all([
          app.courseService.listCourses(m.orgId),
          app.pathService.listPaths(m.orgId),
        ]);
        return {
          courses: courses.filter((c) => c.publishedCommitId != null),
          paths,
        };
      }),
    ]);

    const courseById = new Map<string, (typeof publicCourses)[number]>();
    for (const course of publicCourses) {
      courseById.set(course.id, course);
    }
    for (const bundle of orgBundles) {
      for (const course of bundle.courses) {
        courseById.set(course.id, course);
      }
    }

    const pathById = new Map<string, (typeof publicPaths)[number]>();
    for (const path of publicPaths) {
      pathById.set(path.id, path);
    }
    for (const bundle of orgBundles) {
      for (const path of bundle.paths) {
        pathById.set(path.id, path);
      }
    }

    return {
      courses: [...courseById.values()].map(serializeCourse),
      paths: [...pathById.values()].map(serializePath),
    };
  });

  /**
   * Active enrollments for the signed-in user (courses + paths).
   * Course enrollments come from the learner store; path enrollments from Postgres.
   */
  app.get('/v1/me/enrollments', async (request) => {
    const user = requireJwtUser(request);

    const [courseEnrollments, pathEnrollments] = await Promise.all([
      app.learnerStore.listActiveEnrollmentsByUser(user.id),
      app.pathService.listActiveEnrollmentsForUser(user.id),
    ]);

    const courses = await Promise.all(
      courseEnrollments.map(async (enrollment) => {
        const [progress, course] = await Promise.all([
          app.learnerStore.getProgress(enrollment.id),
          app.courseService.getCourse(enrollment.courseId).catch(() => null),
        ]);
        return {
          enrollment: {
            id: enrollment.id,
            courseId: enrollment.courseId,
            userId: enrollment.userId,
            orgId: enrollment.orgId,
            enrolledAt: enrollment.enrolledAt.toISOString(),
            revokedAt: enrollment.revokedAt ? enrollment.revokedAt.toISOString() : null,
          },
          progress: progress
            ? {
                enrollmentId: progress.enrollmentId,
                courseId: enrollment.courseId,
                publishedCommitId: progress.publishedCommitId,
                completedSectionIds: progress.completedSectionIds,
                currentSectionId: progress.currentSectionId,
                percent: progress.percent,
                updatedAt: progress.updatedAt.toISOString(),
              }
            : null,
          course: course ? serializeCourse(course) : null,
        };
      }),
    );

    const paths = await Promise.all(
      pathEnrollments.map(async (enrollment) => {
        const detail = await app.pathService.getProgress(enrollment.id, user.id).catch(() => null);
        return {
          enrollment: {
            id: enrollment.id,
            pathId: enrollment.pathId,
            userId: enrollment.userId,
            orgId: enrollment.orgId,
            enrolledAt: enrollment.enrolledAt.toISOString(),
            revokedAt: enrollment.revokedAt ? enrollment.revokedAt.toISOString() : null,
          },
          progress: detail
            ? {
                enrollmentId: detail.progress.enrollmentId,
                completedNodeIds: detail.progress.completedNodeIds,
                currentNodeId: detail.progress.currentNodeId,
                percent: detail.progress.percent,
                updatedAt: detail.progress.updatedAt.toISOString(),
              }
            : null,
          path: detail?.path ? serializePath(detail.path) : null,
        };
      }),
    );

    return { courses, paths };
  });
}
