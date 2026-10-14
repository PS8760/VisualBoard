import { Response, NextFunction } from 'express';
import { createVersion, listVersionsByBoard, getVersionById, restoreVersion } from './version.service.js';
import { createVersionSchema, versionIdParamSchema, boardIdParamSchema } from './version.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { notFoundError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardAccess, assertBoardRole } from '../../services/rbac.js';
import { emitToBoard } from '../socket/socket.bus.js';
import { SocketEvents } from '../socket/socket.constants.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    const { snapshot, label } = parseOrThrow(createVersionSchema, req.body);
    await assertBoardRole(req.user, boardId, 'editor');
    const version = await createVersion(boardId, req.user.id, snapshot, label);
    emitToBoard(boardId, SocketEvents.VERSION_CREATED, { boardId, id: version.id });
    sendSuccess(res, version, 201);
  } catch (e) {
    next(e);
  }
};

export const listByBoard = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardAccess(req.user, boardId);
    const versions = await listVersionsByBoard(boardId);
    sendSuccess(res, versions);
  } catch (e) {
    next(e);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, versionId } = parseOrThrow(versionIdParamSchema, req.params);
    await assertBoardAccess(req.user, boardId);
    const version = await getVersionById(versionId);
    // Never leak another board's snapshot through this board's URL.
    if (!version || version.board_id !== boardId) throw notFoundError('Version not found');
    sendSuccess(res, version);
  } catch (e) {
    next(e);
  }
};

export const restore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, versionId } = parseOrThrow(versionIdParamSchema, req.params);
    await assertBoardRole(req.user, boardId, 'owner');
    const { elements, ...result } = await restoreVersion(boardId, versionId, req.user.id);
    // Push the restored state to everyone in the room — collaborators swap
    // their element set in place instead of reloading or disconnecting.
    emitToBoard(boardId, SocketEvents.BOARD_RESTORED, {
      boardId,
      versionId,
      restoredBy: req.user.id,
      elements,
    });
    sendSuccess(res, { ...result, elements });
  } catch (e) {
    next(e);
  }
};

export default { create, listByBoard, getById, restore };
