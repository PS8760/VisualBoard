import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { isAppError, isZodError } from '../utils/errors.js';
import { sendError, ApiCodes } from '../utils/response.js';
import { isProd } from '../config/env.js';

/** Maps known Prisma errors to HTTP responses without leaking internals. */
function prismaStatusCode(e: Prisma.PrismaClientKnownRequestError): { status: number; code: string; message: string } {
  switch (e.code) {
    case 'P2002':
      return { status: 409, code: 'CONFLICT', message: 'A record with that value already exists' };
    case 'P2025':
      return { status: 404, code: 'NOT_FOUND', message: 'Record not found' };
    case 'P2003':
      return { status: 400, code: 'BAD_REQUEST', message: 'Referenced record does not exist' };
    case 'P2014':
      return { status: 400, code: 'BAD_REQUEST', message: 'Invalid record relation' };
    case 'P2000':
      return { status: 400, code: 'BAD_REQUEST', message: 'Provided value is too long for its column' };
    default:
      return { status: 500, code: 'INTERNAL_ERROR', message: 'Database operation failed' };
  }
}

/** 404 handler for unknown routes. */
export const notFoundHandler = (req: Request, res: Response) => {
  sendError(res, 404, ApiCodes.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`);
};

/** Central error handler — the only place errors are converted to responses. */
export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const requestId = req.id ?? '-';

  if (isZodError(err)) {
    const details = (err as ZodError).issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    sendError(res, 422, ApiCodes.VALIDATION_ERROR, 'Invalid request data', details);
    return;
  }

  if (isAppError(err)) {
    sendError(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaStatusCode(err);
    logger.warn({ requestId, code: err.code }, 'prisma request error');
    sendError(res, mapped.status, mapped.code, mapped.message);
    return;
  }

  if ((err instanceof SyntaxError || (typeof err === 'object' && err !== null && (err as { type?: string }).type === 'entity.parse.failed'))) {
    sendError(res, 400, ApiCodes.BAD_REQUEST, 'Malformed JSON in request body');
    return;
  }

  if (typeof err === 'object' && err !== null && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    sendError(res, 413, ApiCodes.PAYLOAD_TOO_LARGE, 'Uploaded file exceeds the size limit');
    return;
  }

  if (typeof err === 'object' && err !== null && typeof (err as { code?: string }).code === 'string' && (err as { code: string }).code.startsWith('LIMIT_')) {
    sendError(res, 400, ApiCodes.BAD_REQUEST, 'Invalid upload');
    return;
  }

  const message = err instanceof Error ? err.message : 'Unknown error';
  if (!isProd) {
    logger.error({ requestId, err }, `unhandled error: ${message}`);
  } else {
    logger.error({ requestId, err }, 'unhandled error');
  }
  sendError(res, 500, ApiCodes.INTERNAL, 'Internal server error');
};

export default errorHandler;
