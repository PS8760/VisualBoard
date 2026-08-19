import { Response, NextFunction } from 'express';
import { createElement, listElementsByBoard, updateElement, replaceElementData, deleteElement, bulkSyncElements } from './element.service.js';
import { createElementSchema, updateElementSchema, bulkSyncSchema, elementIdParamSchema, boardIdParamSchema } from './element.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { badRequestError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardRole, assertBoardAccess } from '../../services/rbac.js';
import { getStorage } from '../../services/storage/index.js';
import { uid } from '../../utils/id.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    const { element } = parseOrThrow(createElementSchema, req.body);
    await assertBoardRole(req.user, boardId, 'editor');

    const id = typeof element.id === 'string' && element.id ? element.id : uid('el');
    const row = await createElement(boardId, element, id);
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
    const row = await updateElement(elementId, patch);
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
    const row = await replaceElementData(elementId, element);
    sendSuccess(res, row);
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, elementId } = parseOrThrow(elementIdParamSchema, req.params);
    await assertBoardRole(req.user, boardId, 'editor');
    const removedDocKeys = await deleteElement(elementId);
    const storage = getStorage();
    for (const key of removedDocKeys) {
      await storage.delete(key).catch(() => undefined);
    }
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

    const result = await bulkSyncElements(boardId, elements as Array<Record<string, unknown> & { id: string }>);
    sendSuccess(res, { ...result, boardId });
  } catch (e) {
    next(e);
  }
};

function elementIdValid(id: unknown): id is string {
  return typeof id === 'string' && id.length >= 1 && id.length <= 64;
}

export default { create, listByBoard, update, replace, remove, bulkSync };