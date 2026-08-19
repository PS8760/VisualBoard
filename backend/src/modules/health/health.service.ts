import prisma from '../../config/prisma.js';
import { redisClient } from '../../config/redis.js';

export const getDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

export const getRedisHealth = async (): Promise<boolean> => {
  try {
    if (!redisClient || !redisClient.isOpen) return false;
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
};

export const getHealthStatus = () => ({
  success: true,
  service: 'visualboard-api',
  status: 'ok',
  timestamp: new Date().toISOString(),
});

export default { getDatabaseHealth, getRedisHealth, getHealthStatus };