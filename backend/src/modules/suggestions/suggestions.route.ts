import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware.js';
import controller from './suggestions.controller.js';

const router = Router();

router.post('/boards/:boardId/suggestions', authenticate, controller.getBoardSuggestions);

export default router;
