import http from 'node:http';
import { env } from './config/env.js';
import app from './app.js';
import initSocket from './modules/socket/socket.js';
import { logger } from './utils/logger.js';
import { flushAllSnapshots } from './modules/version/version.autosnapshot.js';

const PORT = env.PORT;

const server = http.createServer(app);

const io = initSocket(server);

server.listen(PORT, () => {
  logger.info(`visualboard api listening on http://localhost:${PORT}`);
});

let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  setTimeout(() => process.exit(1), 10_000).unref();
  // Persist pending auto-snapshots, then close sockets (clients reconnect to
  // another instance and resync) and finally the HTTP server.
  void flushAllSnapshots()
    .catch((err) => logger.warn({ err }, 'failed to flush snapshots on shutdown'))
    .finally(() => {
      io.close();
      server.close(() => process.exit(0));
    });
};

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
});

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));