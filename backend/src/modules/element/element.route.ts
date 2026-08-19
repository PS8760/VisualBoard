import { Router } from 'express';
import { create, listByBoard, update, replace, remove, bulkSync } from './element.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { writeLimiter } from '../../middleware/rate-limit.middleware.js';

const elementRoutes = Router();

elementRoutes.get('/boards/:boardId/elements', authenticate, listByBoard);
elementRoutes.post('/boards/:boardId/elements', authenticate, writeLimiter, create);
elementRoutes.put('/boards/:boardId/elements/bulk', authenticate, writeLimiter, bulkSync);
elementRoutes.put('/boards/:boardId/elements/:elementId', authenticate, writeLimiter, replace);
elementRoutes.patch('/boards/:boardId/elements/:elementId', authenticate, writeLimiter, update);
elementRoutes.delete('/boards/:boardId/elements/:elementId', authenticate, writeLimiter, remove);

export default elementRoutes;