import { Router } from 'express';
import { create, listByBoard, update, remove } from './comment.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { writeLimiter } from '../../middleware/rate-limit.middleware.js';

const commentRoutes = Router();

commentRoutes.get('/boards/:boardId/comments', authenticate, listByBoard);
commentRoutes.post('/boards/:boardId/comments', authenticate, writeLimiter, create);
commentRoutes.put('/boards/:boardId/comments/:commentId', authenticate, writeLimiter, update);
commentRoutes.delete('/boards/:boardId/comments/:commentId', authenticate, writeLimiter, remove);

export default commentRoutes;