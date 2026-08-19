import { Router } from 'express';
import {
  me,
  update,
  setPassword,
  search,
  avatarUpload,
  uploadAvatar,
  serveAvatar,
} from './user.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { writeLimiter } from '../../middleware/rate-limit.middleware.js';

const userRoutes = Router();

userRoutes.get('/users/me', authenticate, me);
userRoutes.put('/users/me', authenticate, writeLimiter, update);
userRoutes.post('/users/me/password', authenticate, writeLimiter, setPassword);
userRoutes.post('/users/me/avatar', authenticate, writeLimiter, avatarUpload.single('avatar'), uploadAvatar);
userRoutes.get('/users/search', authenticate, search);
userRoutes.get('/users/:userId/avatar', serveAvatar);

export default userRoutes;