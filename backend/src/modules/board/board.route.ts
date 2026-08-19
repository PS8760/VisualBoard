import { Router } from 'express';
import {
  create,
  list,
  getById,
  update,
  remove,
  getMembers,
  add,
  invite,
  updateMember,
  removeMember,
  arrangeBoard,
} from './board.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { writeLimiter } from '../../middleware/rate-limit.middleware.js';

const boardRoutes = Router();

boardRoutes.get('/boards', authenticate, list);
boardRoutes.post('/boards', authenticate, writeLimiter, create);
boardRoutes.get('/boards/:id', authenticate, getById);
boardRoutes.put('/boards/:id', authenticate, writeLimiter, update);
boardRoutes.delete('/boards/:id', authenticate, writeLimiter, remove);

boardRoutes.get('/boards/:id/members', authenticate, getMembers);
boardRoutes.post('/boards/:id/members', authenticate, writeLimiter, add);
boardRoutes.post('/boards/:id/members/invite', authenticate, writeLimiter, invite);
boardRoutes.put('/boards/:id/members/:userId', authenticate, writeLimiter, updateMember);
boardRoutes.delete('/boards/:id/members/:userId', authenticate, writeLimiter, removeMember);

boardRoutes.post('/boards/:id/arrange', authenticate, writeLimiter, arrangeBoard);

export default boardRoutes;