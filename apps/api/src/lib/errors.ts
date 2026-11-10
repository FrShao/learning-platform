import { DomainError } from '@lp/domain';
import type { FastifyReply } from 'fastify';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): FastifyReply {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return reply.status(status).send(body);
}

export function sendDomainError(reply: FastifyReply, err: unknown): boolean {
  if (!(err instanceof DomainError)) {
    return false;
  }
  const status = err.code === 'not_found' ? 404 : err.code === 'conflict' ? 409 : 400;
  sendError(reply, status, err.code, err.message, err.details);
  return true;
}
