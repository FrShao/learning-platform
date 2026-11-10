import type { User } from '@lp/domain';
import type { FastifyRequest } from 'fastify';

import { unauthorized } from '../errors.js';

export function requireJwtUser(request: FastifyRequest): User {
  if (!request.auth || request.auth.kind !== 'jwt') {
    throw unauthorized('Bearer JWT required');
  }
  return request.auth.user;
}
