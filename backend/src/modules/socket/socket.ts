import { createServer } from 'node:http';
import { Server } from 'socket.io';
import handleConnection from './socket.handler.js';
import { SocketEvents } from './socket.constants.js';
import { verifyToken } from '../../utils/jwt.js';
import { isRedisAvailable, redisClient } from '../../config/redis.js';
import { logger } from '../../utils/logger.js';
import { corsOrigins } from '../../config/env.js';
import type { AuthenticatedSocket } from './socket.types.js';

const REDIS_ADAPTER_ENABLED = process.env.REDIS_ADAPTER !== 'false';

const initSocket = (server: ReturnType<typeof createServer>) => {
  const io = new Server(server, {
    cors: {
      origin: corsOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  // Authentication gate: reject failed handshakes before any listener runs.
  io.use((socket, next) => {
    const token = (socket.handshake.auth?.token as string | undefined) ?? '';
    const payload = token ? verifyToken(token) : null;
    if (!payload) {
      return next(new Error('ERR_UNAUTHORIZED'));
    }
    socket.data.userId = payload.id;
    socket.data.userName = '';
    socket.data.joinedBoards = new Set<number>();
    next();
  });

  // Load user name for presence display (best effort, non-blocking).
  io.use(async (socket, next) => {
    const { default: prisma } = await import('../../config/prisma.js');
    prisma.users
      .findUnique({ where: { id: socket.data.userId }, select: { name: true } })
      .then((u) => {
        socket.data.userName = u?.name ?? 'User';
        next();
      })
      .catch(() => {
        socket.data.userName = 'User';
        next();
      });
  });

  // Optional Redis adapter: enables multi-instance broadcasting.
  if (REDIS_ADAPTER_ENABLED && isRedisAvailable() && redisClient) {
    (async () => {
      try {
        const { createAdapter } = await import('@socket.io/redis-adapter');
        const pub = redisClient.duplicate();
        const sub = redisClient.duplicate();
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
};

export default initSocket;