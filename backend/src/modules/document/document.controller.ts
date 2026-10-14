import { Response, NextFunction } from 'express';
import multer from 'multer';
import {
  storeDocument,
  listDocumentsByBoard,
  getDocumentById,
  deleteDocument,
} from './document.service.js';
import { documentIdParamSchema, boardIdParamSchema, MAX_UPLOAD_BYTES } from './document.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { badRequestError, notFoundError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardAccess, assertBoardRole } from '../../services/rbac.js';
import { getStorage } from '../../services/storage/index.js';
import { sanitizeFileName } from './document.service.js';
import { emitToBoard } from '../socket/socket.bus.js';
import { SocketEvents } from '../socket/socket.constants.js';
import { DocumentErrors } from './document.constants.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

/** Memory-storage upload: the file is validated + persisted by the service layer. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 8 },
});

export const attach = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardRole(req.user, boardId, 'editor');

    if (!req.file) throw badRequestError(DocumentErrors.MISSING);

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

/** RFC 6266/5987 header: ASCII fallback + exact UTF-8 name. */
function contentDisposition(name: string) {
  const safe = sanitizeFileName(name);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

export const download = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { documentId } = parseOrThrow(documentIdParamSchema, req.params);
    const doc = await getDocumentById(documentId);
    if (!doc) throw notFoundError('Document not found');
    await assertBoardAccess(req.user, doc.board_id);

    const object = await getStorage().stream(doc.stored_name);
    if (!object) throw notFoundError('Document content is missing from storage');

    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', contentDisposition(doc.original_name));
    res.setHeader('Content-Length', String(object.size ?? doc.size));
    // Storage keys are immutable; let the browser reuse the bytes for previews.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    object.body.on('error', (err) => {
      if (!res.headersSent) next(err);
      else res.destroy(err);
    });
    object.body.pipe(res);
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

    const { doc: deleted, detached } = await deleteDocument(documentId);
    await getStorage().delete(deleted.stored_name).catch(() => undefined);
    for (const row of detached) {
      emitToBoard(deleted.board_id, SocketEvents.ELEMENT_UPDATED, {
        boardId: deleted.board_id,
        id: row.id,
        element: row.element_data,
      });
    }
    sendSuccess(res, { id: deleted.id });
  } catch (e) {
    next(e);
  }
};

export default { upload, attach, list, getById, download, remove };
