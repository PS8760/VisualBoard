import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      id: string;
      requestId: string;
    }
  }
}

/** Attaches a request id to every request (also surfaced as X-Request-Id). */
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers['x-request-id'] as string | undefined) ?? randomUUID();
  req.id = id;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
};

export default requestId;
