import { Response, NextFunction } from 'express';
import { createComment, listCommentsByBoard, updateComment, deleteComment } from './comment.service.js';
import { createCommentSchema, updateCommentSchema, commentIdParamSchema, boardIdParamSchema } from './comment.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardAccess } from '../../services/rbac.js';
import { emitToBoard } from '../socket/socket.bus.js';
import { SocketEvents } from '../socket/socket.constants.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    const parsed = parseOrThrow(createCommentSchema, req.body);
    await assertBoardAccess(req.user, boardId);
    const comment = await createComment(boardId, req.user.id, parsed.content, {
      element_id: parsed.element_id ?? null,
      x: parsed.x ?? null,
      y: parsed.y ?? null,
    });
    // clientId lets the author's tab swap its optimistic copy for this one.
    emitToBoard(boardId, SocketEvents.COMMENT_CREATED, { boardId, comment, clientId: parsed.clientId ?? null });
    sendSuccess(res, comment, 201);
  } catch (e) {
    next(e);
  }
};

export const listByBoard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardAccess(req.user, boardId);
    const comments = await listCommentsByBoard(boardId);
    sendSuccess(res, comments);
  } catch (e) {
    next(e);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, commentId } = parseOrThrow(commentIdParamSchema, req.params);
    const parsed = parseOrThrow(updateCommentSchema, req.body);
    await assertBoardAccess(req.user, boardId);
    const comment = await updateComment(boardId, commentId, req.user.id, parsed.content);
    emitToBoard(boardId, SocketEvents.COMMENT_UPDATED, { boardId, comment });
    sendSuccess(res, comment);
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, commentId } = parseOrThrow(commentIdParamSchema, req.params);
    const role = await assertBoardAccess(req.user, boardId);
    const comment = await deleteComment(boardId, commentId, req.user.id, role === 'owner');
    emitToBoard(boardId, SocketEvents.COMMENT_REMOVED, { boardId, id: comment.id });
    sendSuccess(res, { id: comment.id });
  } catch (e) {
    next(e);
  }
};

export default { create, listByBoard, update, remove };
