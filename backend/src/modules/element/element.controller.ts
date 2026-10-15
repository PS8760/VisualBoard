import { Response, NextFunction } from 'express';
import { createElement, listElementsByBoard, updateElement, replaceElementData, deleteElement, bulkSyncElements } from './element.service.js';
import { createElementSchema, updateElementSchema, bulkSyncSchema, elementIdParamSchema, boardIdParamSchema } from './element.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { badRequestError, notFoundError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardRole, assertBoardAccess } from '../../services/rbac.js';
import { uid } from '../../utils/id.js';
import { emitToBoard } from '../socket/socket.bus.js';
import { SocketEvents } from '../socket/socket.constants.js';
import { broadcastUnpinnedComments } from '../comment/comment.service.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    const { element } = parseOrThrow(createElementSchema, req.body);
    await assertBoardRole(req.user, boardId, 'editor');

    const id = typeof element.id === 'string' && element.id ? element.id : uid('el');
    const row = await createElement(boardId, element, id, { overwrite: true, userId: req.user.id });
    emitToBoard(boardId, SocketEvents.ELEMENT_CREATED, { boardId, element: row.element_data });
    sendSuccess(res, row, 201);
  } catch (e) {
    next(e);
  }
};

export const listByBoard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardAccess(req.user, boardId);
    const elements = await listElementsByBoard(boardId);
    sendSuccess(res, elements);
  } catch (e) {
    next(e);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, elementId } = parseOrThrow(elementIdParamSchema, req.params);
    const { patch } = parseOrThrow(updateElementSchema, req.body);
    await assertBoardRole(req.user, boardId, 'editor');
    const row = await updateElement(boardId, elementId, patch, { userId: req.user.id });
    emitToBoard(boardId, SocketEvents.ELEMENT_UPDATED, { boardId, id: elementId, element: row.element_data });
    sendSuccess(res, row);
  } catch (e) {
    next(e);
  }
};

export const replace = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, elementId } = parseOrThrow(elementIdParamSchema, req.params);
    const { element } = parseOrThrow(createElementSchema, req.body);
    await assertBoardRole(req.user, boardId, 'editor');
    const row = await replaceElementData(boardId, elementId, element, { userId: req.user.id });
    emitToBoard(boardId, SocketEvents.ELEMENT_UPDATED, { boardId, id: elementId, element: row.element_data });
    sendSuccess(res, row);
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, elementId } = parseOrThrow(elementIdParamSchema, req.params);
    await assertBoardRole(req.user, boardId, 'editor');
    const { deleted, unpinnedCommentIds } = await deleteElement(boardId, elementId, { userId: req.user.id });
    if (!deleted) throw notFoundError('Element not found');
    emitToBoard(boardId, SocketEvents.ELEMENT_REMOVED, { boardId, id: elementId });
    await broadcastUnpinnedComments(boardId, unpinnedCommentIds);
    sendSuccess(res, { id: elementId });
  } catch (e) {
    next(e);
  }
};

export const bulkSync = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    const { elements } = parseOrThrow(bulkSyncSchema, req.body);
    await assertBoardRole(req.user, boardId, 'editor');

    if (!elements.every((el) => elementIdValid(el.id))) {
      throw badRequestError('Every element must carry a valid id');
    }

    const result = await bulkSyncElements(boardId, elements as Array<Record<string, unknown> & { id: string }>, {
      userId: req.user.id,
    });
    // A bulk replace is equivalent to a restore from the room's point of view.
    const rows = await listElementsByBoard(boardId);
    emitToBoard(boardId, SocketEvents.BOARD_RESTORED, {
      boardId,
      restoredBy: req.user.id,
      elements: rows.map((r) => r.element_data),
    });
    sendSuccess(res, { ...result, boardId });
  } catch (e) {
    next(e);
  }
};

function elementIdValid(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 64;
}

export default { create, listByBoard, update, replace, remove, bulkSync };
