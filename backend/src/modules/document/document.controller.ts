import { Response, NextFunction } from 'express';
import multer from 'multer';
import {
  storeDocument,
  listDocumentsByBoard,
  getDocumentById,
  deleteDocument,
} from './document.service.js';
import { documentIdParamSchema, boardIdParamSchema } from './document.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { notFoundError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardAccess, assertBoardRole } from '../../services/rbac.js';
import { getStorage } from '../../services/storage/index.js';
import { sanitizeFileName } from './document.service.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

/** Memory-storage upload: the file is validated + persisted by the service layer. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const attach = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardRole(req.user, boardId, 'editor');

    if (!req.file) {
      sendSuccess(res, { message: 'No file was provided' }, 400);
      return;
    }

    const elementId =
      typeof req.body?.elementId === 'string' && req.body.elementId ? req.body.elementId : undefined;

    const doc = await storeDocument(boardId, req.user.id, req.file, elementId);
    sendSuccess(res, doc, 201);
  } catch (e) {
    next(e);
  }
};

export const list = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardAccess(req.user, boardId);
    const docs = await listDocumentsByBoard(boardId);
    sendSuccess(res, docs);
  } catch (e) {
    next(e);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { documentId } = parseOrThrow(documentIdParamSchema, req.params);
    const doc = await getDocumentById(documentId);
    if (!doc) throw notFoundError('Document not found');
    await assertBoardAccess(req.user, doc.board_id);
    sendSuccess(res, doc);
  } catch (e) {
    next(e);
  }
};

export const download = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { documentId } = parseOrThrow(documentIdParamSchema, req.params);
    const doc = await getDocumentById(documentId);
    if (!doc) throw notFoundError('Document not found');
    await assertBoardAccess(req.user, doc.board_id);

    const storage = getStorage();
    const data = await storage.read(doc.stored_name);
    if (!data) throw notFoundError('Document content is missing from storage');

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(sanitizeFileName(doc.original_name))}"`,
    );
    res.setHeader('Content-Length', String(data.length));
    res.send(data);
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { documentId } = parseOrThrow(documentIdParamSchema, req.params);
    const doc = await getDocumentById(documentId);
    if (!doc) throw notFoundError('Document not found');
    await assertBoardRole(req.user, doc.board_id, 'editor');

    const deleted = await deleteDocument(documentId);
    await getStorage().delete(deleted.stored_name).catch(() => undefined);
    sendSuccess(res, { id: deleted.id });
  } catch (e) {
    next(e);
  }
};

export default { upload, attach, list, getById, download, remove };