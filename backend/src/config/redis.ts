import { createClient, type RedisClientType } from 'redis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Redis is an optional dependency. The app starts and serves traffic even when
 * Redis is down; features that need it degrade gracefully.
 *
 * Set REDIS_URL to an empty string (or "disabled") to turn Redis off entirely
 * — no connection is attempted in that case.
 */
const url = (env.REDIS_URL ?? '').trim();
const redisDisabled = url === '' || url.toLowerCase() === 'disabled';

// Back off from ~1s to 30s instead of the library default of 2s, so a Redis
// started later is still picked up without hammering (and spamming) the logs.
const reconnectStrategy = (retries: number) => Math.min(2 ** retries * 500, 30_000);

const redisClient: RedisClientType | null = redisDisabled
  ? null
  : createClient({ url, socket: { reconnectStrategy } });

let connected = false;
let downLogged = false;

/** Log an outage once on the first failure; stay quiet on subsequent retries. */
const markDown = (err: unknown) => {
  connected = false;
  if (downLogged) return;
  downLogged = true;
  logger.warn({ err }, 'redis unavailable — continuing without redis');
};

redisClient?.on('error', markDown);

redisClient?.on('ready', () => {
  connected = true;
  if (downLogged) logger.info('redis connection established (recovered)');
  else logger.info('connected to redis');
  downLogged = false;
});

if (redisClient) {
  redisClient.connect().catch(markDown);
} else {
  logger.info('redis disabled (REDIS_URL is empty) — running without redis');
}

export const isRedisAvailable = () => connected;

/**
 * Resolves true once Redis is ready (false on timeout or when disabled).
 * The initial connect is asynchronous, so a synchronous isRedisAvailable()
 * check at boot always reported false.
 */
export function whenRedisReady(timeoutMs = 5_000): Promise<boolean> {
  const client = redisClient;
  if (!client) return Promise.resolve(false);
  if (connected) return Promise.resolve(true);
  return new Promise((resolve) => {
    const onReady = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      client.off('ready', onReady);
      resolve(false);
    }, timeoutMs);
    timer.unref();
    client.once('ready', onReady);
  });
}

export { redisClient };
export default redisClient;
