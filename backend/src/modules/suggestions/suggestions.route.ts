import { Router } from 'express';
import controller from './suggestions.controller.js';

const router = Router();

router.get('/board/:boardId', controller.getBoardSuggestions);
export default router;