import http from 'node:http';
import { env } from './config/env.js';
import app from './app.js';
import initSocket from './modules/socket/socket.js';
import { logger } from './utils/logger.js';

const PORT = env.PORT;

const server = http.createServer(app);

initSocket(server);

server.listen(PORT, () => {
  logger.info(`visualboard api listening on http://localhost:${PORT}`);
});

const shutdown = (signal: string) => {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));