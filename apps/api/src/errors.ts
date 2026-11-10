export type ApiErrorCode =
  'unauthorized' | 'forbidden' | 'not_found' | 'validation' | 'conflict' | 'internal';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function unauthorized(message = 'Unauthorized'): ApiError {
  return new ApiError('unauthorized', message, 401);
}

export function forbidden(message = 'Forbidden'): ApiError {
  return new ApiError('forbidden', message, 403);
}

export function notFound(message = 'Not found'): ApiError {
  return new ApiError('not_found', message, 404);
}

export function validation(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError('validation', message, 400, details);
}

export function conflict(message: string, details?: Record<string, unknown>): ApiError {
  return new ApiError('conflict', message, 409, details);
}
