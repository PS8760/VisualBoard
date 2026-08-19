import { createClient, type RedisClientType } from 'redis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Redis is an optional dependency. The app starts and serves traffic even when
 * Redis is down; features that need it degrade gracefully.
 */
const redisClient: RedisClientType | null = createClient({ url: env.REDIS_URL });

let connected = false;

redisClient?.on('error', (err) => {
  logger.warn({ err }, 'redis client error (continuing without redis)');
});

redisClient?.connect().then(() => {
  connected = true;
  logger.info('connected to redis');
}).catch((err: unknown) => {
  connected = false;
  logger.warn({ err }, 'redis unavailable — running without redis');
});

export const isRedisAvailable = () => connected;

export { redisClient };
export default redisClient;
