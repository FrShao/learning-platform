import { CourseRepository, findOrganizationById, getMembership, type DbClient } from '@lp/db';
import { DEFAULT_ORG_SETTINGS as DOMAIN_ORG_SETTINGS } from '@lp/domain';
import type { FastifyInstance } from 'fastify';

import type { CoursePublishedReader, OrgMembershipReader } from './ports.js';
import type { CourseSummary, PublishedCourseView } from './types.js';

import { createLearnerRuntime, handleLearnerRequest } from './index.js';

/**
 * Mount learner `/v1` routes onto Fastify using the module's HTTP adapter.
 */
export async function registerLearnerRoutes(app: FastifyInstance, client: DbClient): Promise<void> {
  const courses = createCoursePublishedReader(client);
  const memberships = createOrgMembershipReader(client);
  const runtime = createLearnerRuntime({
    courses,
    memberships,
  });
  app.decorate('learnerStore', runtime.store);

  const paths = [
    { method: 'POST' as const, url: '/v1/courses/:courseId/enroll' },
    { method: 'GET' as const, url: '/v1/courses/:courseId/published' },
    { method: 'GET' as const, url: '/v1/enrollments/:enrollmentId/progress' },
    {
      method: 'POST' as const,
      url: '/v1/enrollments/:enrollmentId/sections/:sectionId/complete',
    },
    {
      method: 'POST' as const,
      url: '/v1/enrollments/:enrollmentId/forms/:blockId/attempt',
    },
  ];

  for (const route of paths) {
    app.route({
      method: route.method,
      url: route.url,
      handler: async (request, reply) => {
        reply.hijack();
        const auth = request.auth;
        const resolveActor = async () => {
          if (auth?.kind === 'jwt') {
            return { kind: 'user' as const, userId: auth.user.id };
          }
          return null;
        };
        await handleLearnerRequest(request.raw, reply.raw, {
          service: runtime.service,
          resolveActor,
        });
      },
    });
  }
}

function createCoursePublishedReader(client: DbClient): CoursePublishedReader {
  const repo = new CourseRepository(client.db);
  return {
    async getCourse(courseId): Promise<CourseSummary | null> {
      const course = await repo.getById(courseId);
      if (!course) {
        return null;
      }
      return {
        id: course.id,
        orgId: course.orgId,
        ownerUserId: course.ownerUserId,
        slug: course.slug,
        title: course.title,
        publishedCommitId: course.publishedCommitId,
        deletedAt: course.deletedAt,
      };
    },
    async getPublished(courseId): Promise<PublishedCourseView | null> {
      const course = await repo.getById(courseId);
      if (!course || !course.publishedCommitId) {
        return null;
      }
      const snapshot = await repo.getCommitTree(courseId, course.publishedCommitId);
      return {
        courseId: course.id,
        orgId: course.orgId,
        title: course.title,
        slug: course.slug,
        publishedCommitId: course.publishedCommitId,
        tree: snapshot.tree,
      };
    },
  };
}

function createOrgMembershipReader(client: DbClient): OrgMembershipReader {
  return {
    async getMembership(orgId, userId) {
      const membership = await getMembership(client.db, orgId, userId);
      if (!membership) {
        return null;
      }
      return {
        orgId: membership.orgId,
        userId: membership.userId,
        role: membership.role,
      };
    },
    async getOrgSettings(orgId) {
      const org = await findOrganizationById(client.db, orgId);
      if (!org) {
        return DOMAIN_ORG_SETTINGS;
      }
      return org.settings;
    },
  };
}
