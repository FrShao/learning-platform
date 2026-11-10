/**
 * Bridge course routes onto the shared JWT / API-key auth context.
 */
import type { Actor, ApiKeyScope, OrgId, UserId } from '@lp/domain';
import type { FastifyRequest } from 'fastify';

import { forbidden, unauthorized } from '../errors.js';

export interface CourseAuthContext {
  actor: Actor;
  /** Effective user id for authorship (JWT sub, or API key creator). */
  userId: UserId;
  /** Org context when known (API key org); JWT callers may resolve per-route. */
  orgId: OrgId | null;
  scopes: ApiKeyScope[] | null;
}

/**
 * Map the global auth middleware context into the course auth shape.
 */
export function requireAuth(request: FastifyRequest): CourseAuthContext {
  const auth = request.auth;
  if (!auth) {
    throw unauthorized('Authentication required');
  }

  if (auth.kind === 'jwt') {
    return {
      actor: { kind: 'user', userId: auth.user.id },
      userId: auth.user.id,
      orgId: null,
      scopes: null,
    };
  }

  return {
    actor: {
      kind: 'api_key',
      apiKeyId: auth.apiKey.id,
      orgId: auth.org.id,
      scopes: auth.scopes,
    },
    userId: auth.apiKey.createdBy,
    orgId: auth.org.id,
    scopes: auth.scopes,
  };
}

export function assertCourseWrite(auth: CourseAuthContext): void {
  if (auth.scopes && !auth.scopes.includes('courses:write')) {
    throw forbidden('API key lacks courses:write');
  }
}

export function assertCoursePublish(auth: CourseAuthContext): void {
  if (auth.scopes && !auth.scopes.includes('courses:publish')) {
    throw forbidden('API key lacks courses:publish');
  }
}
