import { z } from 'zod';
import { ZodError } from 'zod';

/** Application error carrying an HTTP status + machine-readable code. */
export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const notFoundError = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message);

export const forbiddenError = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);

export const unauthorizedError = (message = 'Authentication required') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const conflictError = (message: string, details?: unknown) =>
  new AppError(409, 'CONFLICT', message, details);

export const badRequestError = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const validationError = (issues: z.ZodIssue[]) =>
  new AppError(422, 'VALIDATION_ERROR', 'Invalid request data', issues);

export const unavailableError = (message = 'This feature is temporarily unavailable') =>
  new AppError(503, 'SERVICE_UNAVAILABLE', message);

export const upstreamError = (message = 'An external service failed') =>
  new AppError(502, 'UPSTREAM_ERROR', message);

export const isAppError = (e: unknown): e is AppError => e instanceof AppError;

export const isZodError = (e: unknown): e is ZodError => e instanceof ZodError;

export default AppError;
