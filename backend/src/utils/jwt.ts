import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export interface JwtPayload {
  id: number;
  email: string;
}

const secret = env.JWT_SECRET;

if (!secret) {
  throw new Error('[jwt] JWT_SECRET must be configured');
}

export const signToken = (payload: JwtPayload, expiresIn: string = env.JWT_EXPIRES_IN) => {
  return jwt.sign(
    { id: payload.id, email: payload.email },
    secret as jwt.Secret,
    { expiresIn: expiresIn as jwt.SignOptions['expiresIn'], issuer: 'visualboard-api', audience: 'visualboard-web' },
  );
};

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, secret as jwt.Secret, {
      issuer: 'visualboard-api',
      audience: 'visualboard-web',
    });
    const { id, email } = decoded as jwt.JwtPayload;
    if (typeof id !== 'number' || typeof email !== 'string') return null;
    return { id, email };
  } catch {
    return null;
  }
};

export const requireToken = (token: string): JwtPayload => {
  const payload = verifyToken(token);
  if (!payload) throw new AppError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  return payload;
};

export default { signToken, verifyToken, requireToken };
