import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../config/env.js';

const WINDOW_MS = env.RATE_LIMIT_WINDOW_MS;

const handler: Options['handler'] = (req, res) => {
  res.status(429).json({
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down' },
  });
};

/** Generous default applied to the whole API. */
export const defaultLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  message: undefined,
});

/** Strict limiter for credential endpoints (login/register/OAuth). */
export const authLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  message: undefined,
});

/** Moderate limiter for write-heavy operations (comments, elements, boards). */
export const writeLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: env.RATE_LIMIT_WRITE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  message: undefined,
});

export default { defaultLimiter, authLimiter, writeLimiter };
