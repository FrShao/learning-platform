import type { ApiErrorCode } from './types.js';

export class LearnerError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;
  readonly status: number;

  constructor(
    code: ApiErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'LearnerError';
    this.code = code;
    if (options?.details !== undefined) {
      this.details = options.details;
    }
    this.status = statusForCode(code);
  }
}

function statusForCode(code: ApiErrorCode): number {
  switch (code) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'validation':
      return 400;
    case 'conflict':
      return 409;
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

export function toErrorBody(err: LearnerError): {
  error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> };
} {
  return {
    error: {
      code: err.code,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    },
  };
}
