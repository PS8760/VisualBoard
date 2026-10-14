import { createServer } from 'node:http';
import { Server } from 'socket.io';
import handleConnection from './socket.handler.js';
import { SocketEvents } from './socket.constants.js';
import { verifyToken } from '../../utils/jwt.js';
import { redisClient, whenRedisReady } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { corsOrigins } from '../../config/env.js';
import { bindRealtime } from './socket.bus.js';
import prisma from '../../config/prisma.js';
import type { AuthenticatedSocket } from './socket.types.js';

const REDIS_ADAPTER_ENABLED = process.env.REDIS_ADAPTER !== 'false';

const initSocket = (server: ReturnType<typeof createServer>) => {
  const io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Detect dead connections within ~18s (default 45s) so clients that lose
    // the network silently are dropped from presence and resync sooner.
    pingInterval: 10_000,
    pingTimeout: 8_000,
    // Elements are capped at ~200KB by validation; leave headroom, no more.
    maxHttpBufferSize: 1_000_000,
  });

  bindRealtime(io);

  // Authentication gate: reject failed handshakes before any listener runs,
  // and resolve the display name used for presence in the same step. A token
  // for a user that no longer exists is rejected too.
  io.use(async (socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error('ERR_UNAUTHORIZED'));
    try {
      const user = await prisma.users.findUnique({ where: { id: payload.id }, select: { name: true } });
      if (!user) return next(new Error('ERR_UNAUTHORIZED'));
      socket.data.userName = user.name || 'User';
    } catch (err) {
      logger.warn({ err }, 'socket auth: user lookup failed');
      socket.data.userName = 'User';
    }
    socket.data.userId = payload.id;
    socket.data.joinedBoards = new Set<number>();
    next();
  });

  // Optional Redis adapter: enables multi-instance broadcasting. Wait for the
  // client to be ready instead of sampling its state synchronously at boot.
  if (REDIS_ADAPTER_ENABLED && redisClient) {
    const client = redisClient;
    void (async () => {
      if (!(await whenRedisReady())) {
        logger.warn('redis not ready — socket.io using in-memory adapter (single instance)');
        return;
      }
      try {
        const { createAdapter } = await import('@socket.io/redis-adapter');
        const pub = client.duplicate();
        const sub = client.duplicate();
        pub.on('error', (err) => logger.warn({ err }, 'redis adapter pub error'));
        sub.on('error', (err) => logger.warn({ err }, 'redis adapter sub error'));
        await Promise.all([pub.connect(), sub.connect()]);
        io.adapter(createAdapter(pub, sub));
        logger.info('socket.io redis adapter configured');
      } catch (err) {
        logger.warn({ err }, 'failed to configure socket.io redis adapter — using in-memory adapter');
      }
    })();
  } else {
    logger.info('socket.io using in-memory adapter (single instance)');
  }

  io.on(SocketEvents.CONNECT, (socket) => {
    handleConnection(io, socket as AuthenticatedSocket);
  });

  logger.info('socket.io initialized');
  return io;
};

export default initSocket;