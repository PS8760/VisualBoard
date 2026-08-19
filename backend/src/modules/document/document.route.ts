import { Router } from 'express';
import { upload, attach, list, getById, download, remove } from './document.controller.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { writeLimiter } from '../../middleware/rate-limit.middleware.js';

const documentRoutes = Router();

documentRoutes.get('/boards/:boardId/documents', authenticate, list);
documentRoutes.post('/boards/:boardId/documents', authenticate, writeLimiter, upload.single('file'), attach);
documentRoutes.get('/documents/:documentId', authenticate, getById);
documentRoutes.get('/documents/:documentId/download', authenticate, download);
documentRoutes.delete('/documents/:documentId', authenticate, writeLimiter, remove);

export default documentRoutes;