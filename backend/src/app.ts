import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { requestId } from './middleware/request-id.middleware.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';
import { defaultLimiter } from './middleware/rate-limit.middleware.js';
import { logger } from './utils/logger.js';
import { corsOrigins } from './config/env.js';
import healthRoutes from './modules/health/health.route.js';
import authRoutes from './modules/auth/auth.route.js';
import boardRoutes from './modules/board/board.route.js';
import userRoutes from './modules/user/user.route.js';
import elementRoutes from './modules/element/element.route.js';
import commentRoutes from './modules/comment/comment.route.js';
import versionRoutes from './modules/version/version.route.js';
import documentRoutes from './modules/document/document.route.js';
import suggestionsRoutes from './modules/suggestions/suggestions.route.js';

const app = express();

app.set('trust proxy', 1);

app.use(requestId);
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(helmet());
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? req.id,
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(defaultLimiter);

app.use('/api/v1', healthRoutes);
app.use('/api/v1', authRoutes);
app.use('/api/v1', boardRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1', elementRoutes);
app.use('/api/v1', commentRoutes);
app.use('/api/v1', versionRoutes);
app.use('/api/v1', documentRoutes);
app.use('/api/v1', suggestionsRoutes);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'VisualBoard Backend is Running',
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;