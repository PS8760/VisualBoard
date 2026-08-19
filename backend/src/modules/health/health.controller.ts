import { Request, Response } from 'express';
import { getDatabaseHealth, getRedisHealth, getHealthStatus } from './health.service.js';
import { sendSuccess, sendError, ApiCodes } from '../../utils/response.js';

/** Liveness: the process is up. Always 200. */
export const healthCheck = (_req: Request, res: Response) => {
  sendSuccess(res, getHealthStatus());
};

/** Readiness: dependencies (DB + Redis) are reachable. 503 when not ready. */
export const readinessCheck = async (_req: Request, res: Response) => {
  const [db, redis] = await Promise.all([getDatabaseHealth(), getRedisHealth()]);
  const ready = db;
  const payload = {
    status: ready ? 'ready' : 'not_ready',
    checks: { database: db ? 'up' : 'down', redis: redis ? 'up' : 'down' },
    timestamp: new Date().toISOString(),
  };
  if (!ready) {
    sendError(res, 503, ApiCodes.SERVICE_UNAVAILABLE, 'Database is unavailable', payload.checks);
    return;
  }
  sendSuccess(res, payload);
};