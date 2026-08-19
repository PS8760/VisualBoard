import { Response, NextFunction } from 'express';
import { createVersion, listVersionsByBoard, getVersionById, restoreVersion } from './version.service.js';
import { createVersionSchema, versionIdParamSchema, boardIdParamSchema } from './version.validation.js';
import { parseOrThrow } from '../../utils/params.js';
import { notFoundError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardAccess, assertBoardRole } from '../../services/rbac.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId } = parseOrThrow(boardIdParamSchema, req.params);
    const { snapshot } = parseOrThrow(createVersionSchema, req.body);
    await assertBoardRole(req.user, boardId, 'editor');
    const version = await createVersion(boardId, req.user.id, snapshot);
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
    if (!version) throw notFoundError('Version not found');
    sendSuccess(res, version);
  } catch (e) {
    next(e);
  }
};

export const restore = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { boardId, versionId } = parseOrThrow(versionIdParamSchema, req.params);
    await assertBoardRole(req.user, boardId, 'owner');
    const result = await restoreVersion(versionId, req.user.id);
    sendSuccess(res, result);
  } catch (e) {
    next(e);
  }
};

export default { create, listByBoard, getById, restore };