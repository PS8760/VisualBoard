import { Router } from 'express';
import { create, listByBoard, getById, restore } from './version.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { writeLimiter } from '../../middleware/rate-limit.middleware.js';

const versionRoutes = Router();

versionRoutes.get('/boards/:boardId/versions', authenticate, listByBoard);
versionRoutes.post('/boards/:boardId/versions', authenticate, writeLimiter, create);
versionRoutes.get('/boards/:boardId/versions/:versionId', authenticate, getById);
versionRoutes.post('/boards/:boardId/versions/:versionId/restore', authenticate, writeLimiter, restore);

export default versionRoutes;