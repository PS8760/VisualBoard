import { Request, Response, NextFunction } from 'express';
import { requireToken, type JwtPayload } from '../utils/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: JwtPayload;
    }
  }
}

export type AuthRequest = Request;

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Missing bearer token' },
      });
      return;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    const payload = requireToken(token);
    req.user = payload;
    next();
  } catch (e) {
    if (e instanceof Error && 'status' in e) {
      res.status((e as { status: number }).status).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
      });
      return;
    }
    next(e);
  }
};

export default authenticate;