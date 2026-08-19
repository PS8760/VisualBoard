import { Router } from 'express';
import { register, login, githubExchange, googleExchange } from './auth.controller.js';
import { authLimiter } from '../../middleware/rate-limit.middleware.js';

const authRoutes = Router();

authRoutes.post('/auth/register', authLimiter, register);
authRoutes.post('/auth/login', authLimiter, login);
authRoutes.post('/auth/github/exchange', authLimiter, githubExchange);
authRoutes.post('/auth/google/exchange', authLimiter, googleExchange);

export default authRoutes;