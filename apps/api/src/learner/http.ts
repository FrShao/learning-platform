import type { IncomingMessage, ServerResponse } from 'node:http';

import { LearnerError, toErrorBody } from './errors.js';
import type { HeadersLike, ResolveLearnerActor } from './ports.js';
import type { LearnerService } from './service.js';
import type { AnswerValue } from './types.js';

export interface LearnerHttpDeps {
  service: LearnerService;
  resolveActor: ResolveLearnerActor;
}

interface RouteMatch {
  name: 'enroll' | 'published' | 'progress' | 'complete_section' | 'form_attempt';
  params: Record<string, string>;
}

/**
 * Try to handle a learner `/v1` route. Returns true when the request was consumed.
 */
export async function handleLearnerRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: LearnerHttpDeps,
): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const match = matchLearnerRoute(req.method ?? 'GET', url.pathname);
  if (!match) {
    return false;
  }

  try {
    const actor = await deps.resolveActor(nodeHeaders(req));
    if (!actor) {
      throw new LearnerError('unauthorized', 'Authentication required');
    }

    switch (match.name) {
      case 'enroll': {
        const courseId = param(match, 'courseId');
        const result = await deps.service.enroll(actor, courseId);
        sendJson(res, 201, {
          enrollment: serializeEnrollment(result.enrollment),
          progress: serializeProgress(result.progress, result.enrollment.courseId),
        });
        return true;
      }
      case 'published': {
        const courseId = param(match, 'courseId');
        const published = await deps.service.getPublished(actor, courseId);
        sendJson(res, 200, {
          courseId: published.courseId,
          orgId: published.orgId,
          title: published.title,
          slug: published.slug,
          publishedCommitId: published.publishedCommitId,
          tree: published.tree,
          sections: published.tree.sections,
        });
        return true;
      }
      case 'progress': {
        const enrollmentId = param(match, 'enrollmentId');
        const result = await deps.service.getProgress(actor, enrollmentId);
        sendJson(res, 200, {
          enrollment: serializeEnrollment(result.enrollment),
          progress: serializeProgress(result.progress, result.enrollment.courseId),
          ...serializeProgress(result.progress, result.enrollment.courseId),
        });
        return true;
      }
      case 'complete_section': {
        const enrollmentId = param(match, 'enrollmentId');
        const sectionId = param(match, 'sectionId');
        const result = await deps.service.completeSection(actor, enrollmentId, sectionId);
        const progressDto = serializeProgress(result.progress, result.enrollment.courseId);
        sendJson(res, 200, {
          progress: progressDto,
          ...progressDto,
        });
        return true;
      }
      case 'form_attempt': {
        const enrollmentId = param(match, 'enrollmentId');
        const blockId = param(match, 'blockId');
        const body = await readJsonBody(req);
        const answers = extractAnswers(body);
        const attempt = await deps.service.submitFormAttempt(actor, enrollmentId, blockId, answers);
        sendJson(res, 201, {
          attempt: serializeAttempt(attempt),
          ...serializeAttemptResult(attempt),
        });
        return true;
      }
      default: {
        const _exhaustive: never = match.name;
        return _exhaustive;
      }
    }
  } catch (err) {
    if (err instanceof LearnerError) {
      sendJson(res, err.status, toErrorBody(err));
      return true;
    }
    console.error('[learner] unexpected error', err);
    sendJson(res, 500, {
      error: { code: 'validation', message: 'Internal error' },
    });
    return true;
  }
}

export function matchLearnerRoute(method: string, pathname: string): RouteMatch | null {
  const enroll = /^\/v1\/courses\/([^/]+)\/enroll$/.exec(pathname);
  if (enroll && method === 'POST') {
    return { name: 'enroll', params: { courseId: decodeURIComponent(enroll[1]!) } };
  }

  const published = /^\/v1\/courses\/([^/]+)\/published$/.exec(pathname);
  if (published && method === 'GET') {
    return { name: 'published', params: { courseId: decodeURIComponent(published[1]!) } };
  }

  const progress = /^\/v1\/enrollments\/([^/]+)\/progress$/.exec(pathname);
  if (progress && method === 'GET') {
    return {
      name: 'progress',
      params: { enrollmentId: decodeURIComponent(progress[1]!) },
    };
  }

  const complete = /^\/v1\/enrollments\/([^/]+)\/sections\/([^/]+)\/complete$/.exec(pathname);
  if (complete && method === 'POST') {
    return {
      name: 'complete_section',
      params: {
        enrollmentId: decodeURIComponent(complete[1]!),
        sectionId: decodeURIComponent(complete[2]!),
      },
    };
  }

  const attempt = /^\/v1\/enrollments\/([^/]+)\/forms\/([^/]+)\/attempt$/.exec(pathname);
  if (attempt && method === 'POST') {
    return {
      name: 'form_attempt',
      params: {
        enrollmentId: decodeURIComponent(attempt[1]!),
        blockId: decodeURIComponent(attempt[2]!),
      },
    };
  }

  return null;
}

/**
 * Dev/test actor resolver until the auth module wires JWT.
 * Accepts `Authorization: Bearer user:<userId>` or `X-User-Id`.
 */
export async function stubResolveLearnerActor(
  headers: HeadersLike,
): Promise<{ kind: 'user'; userId: string } | null> {
  const explicit = headers.get('x-user-id');
  if (explicit && explicit.trim() !== '') {
    return { kind: 'user', userId: explicit.trim() };
  }
  const auth = headers.get('authorization');
  if (!auth) {
    return null;
  }
  const match = /^Bearer\s+user:(.+)$/i.exec(auth.trim());
  if (!match?.[1]) {
    return null;
  }
  return { kind: 'user', userId: match[1].trim() };
}

function param(match: RouteMatch, key: string): string {
  const value = match.params[key];
  if (!value) {
    throw new LearnerError('validation', `Missing route param ${key}`);
  }
  return value;
}

function nodeHeaders(req: IncomingMessage): HeadersLike {
  return {
    get(name: string): string | null {
      const raw = req.headers[name.toLowerCase()];
      if (Array.isArray(raw)) {
        return raw[0] ?? null;
      }
      return raw ?? null;
    },
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new LearnerError('validation', 'Invalid JSON body');
  }
}

function extractAnswers(body: unknown): AnswerValue[] {
  if (!body || typeof body !== 'object') {
    throw new LearnerError('validation', 'Body must be an object');
  }
  const answers = (body as { answers?: unknown }).answers;
  if (!Array.isArray(answers)) {
    throw new LearnerError('validation', 'answers must be an array');
  }
  return answers as AnswerValue[];
}

function serializeEnrollment(enrollment: {
  id: string;
  courseId: string;
  userId: string;
  orgId: string;
  enrolledAt: Date;
  revokedAt: Date | null;
}) {
  return {
    id: enrollment.id,
    courseId: enrollment.courseId,
    userId: enrollment.userId,
    orgId: enrollment.orgId,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    revokedAt: enrollment.revokedAt?.toISOString() ?? null,
  };
}

function serializeProgress(
  progress: {
    enrollmentId: string;
    publishedCommitId: string;
    completedSectionIds: string[];
    currentSectionId: string | null;
    percent: number;
    updatedAt: Date;
  },
  courseId: string,
) {
  return {
    enrollmentId: progress.enrollmentId,
    courseId,
    publishedCommitId: progress.publishedCommitId,
    completedSectionIds: progress.completedSectionIds,
    currentSectionId: progress.currentSectionId,
    percent: progress.percent,
    updatedAt: progress.updatedAt.toISOString(),
  };
}

function serializeAttempt(attempt: {
  id: string;
  enrollmentId: string;
  sectionId: string;
  formBlockId: string;
  publishedCommitId: string;
  answers: AnswerValue[];
  score: number | null;
  passed: boolean | null;
  grades: unknown[];
  gradedAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: attempt.id,
    enrollmentId: attempt.enrollmentId,
    sectionId: attempt.sectionId,
    formBlockId: attempt.formBlockId,
    publishedCommitId: attempt.publishedCommitId,
    answers: attempt.answers,
    score: attempt.score,
    passed: attempt.passed,
    grades: attempt.grades,
    gradedAt: attempt.gradedAt?.toISOString() ?? null,
    createdAt: attempt.createdAt.toISOString(),
  };
}

function serializeAttemptResult(attempt: {
  score: number | null;
  passed: boolean | null;
  grades: unknown[];
}) {
  return {
    score: attempt.score,
    passed: attempt.passed,
    grades: attempt.grades,
  };
}
