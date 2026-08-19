import { Response, NextFunction } from 'express';
import {
  createBoard,
  getBoardById,
  listBoardsForUser,
  updateBoard,
  deleteBoard,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember as removeBoardMember,
} from './board.service.js';
import { createBoardSchema, updateBoardSchema, boardIdParamSchema, memberIdParamSchema, addMemberSchema, inviteMemberSchema, updateMemberSchema } from './board.validation.js';
import { maybeParse, parseOrThrow } from '../../utils/params.js';
import { notFoundError, forbiddenError } from '../../utils/errors.js';
import { sendSuccess } from '../../utils/response.js';
import { assertBoardRole, assertBoardAccess } from '../../services/rbac.js';
import { getStorage } from '../../services/storage/index.js';
import { getUserForInvite, publicAvatar } from '../user/user.service.js';
import type { AuthRequest } from '../../middleware/auth.middleware.js';

export const create = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = parseOrThrow(createBoardSchema, req.body);
    const board = await createBoard(req.user.id, parsed.title, parsed.description);
    sendSuccess(res, board, 201);
  } catch (e) {
    next(e);
  }
};

export const list = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const boards = await listBoardsForUser(req.user.id);
    sendSuccess(res, boards);
  } catch (e) {
    next(e);
  }
};

export const getById = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardAccess(req.user, id);
    const board = await getBoardById(id);
    if (!board) throw notFoundError('Board not found');
    sendSuccess(res, board);
  } catch (e) {
    next(e);
  }
};

export const update = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(boardIdParamSchema, req.params);
    const { title, description } = maybeParse(updateBoardSchema, req.body);
    await assertBoardRole(req.user, id, 'editor');
    const board = await updateBoard(id, { title, description });
    sendSuccess(res, board);
  } catch (e) {
    next(e);
  }
};

export const remove = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardRole(req.user, id, 'owner');
    const storedKeys = await deleteBoard(id);
    const storage = getStorage();
    for (const key of storedKeys) {
      await storage.delete(key).catch(() => undefined);
    }
    sendSuccess(res, { id });
  } catch (e) {
    next(e);
  }
};

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export const getMembers = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(boardIdParamSchema, req.params);
    await assertBoardAccess(req.user, id);
    const members = await listMembers(id);
    sendSuccess(res, members);
  } catch (e) {
    next(e);
  }
};

export const add = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(boardIdParamSchema, req.params);
    const parsed = parseOrThrow(addMemberSchema, req.body);
    await assertBoardRole(req.user, id, 'owner');
    const member = await addMember(id, parsed.userId, parsed.role);
    sendSuccess(res, member, 201);
  } catch (e) {
    next(e);
  }
};

export const invite = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = parseOrThrow(boardIdParamSchema, req.params);
    const { email, role } = parseOrThrow(inviteMemberSchema, req.body);
    await assertBoardRole(req.user, id, 'owner');

    const user = await getUserForInvite(email);
    if (!user) throw notFoundError(`No account found for ${email}`);

    const member = await addMember(id, user.id, role);
    sendSuccess(
      res,
      { ...member, user: { id: user.id, name: user.name, email: user.email, avatar: publicAvatar(user) } },
      201,
    );
  } catch (e) {
    next(e);
  }
};

export const updateMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, userId } = parseOrThrow(memberIdParamSchema, req.params);
    const parsed = parseOrThrow(updateMemberSchema, req.body);
    await assertBoardRole(req.user, id, 'owner');
    const member = await updateMemberRole(id, userId, parsed.role);
    sendSuccess(res, member);
  } catch (e) {
    next(e);
  }
};

export const removeMember = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, userId } = parseOrThrow(memberIdParamSchema, req.params);
    await assertBoardRole(req.user, id, 'owner');
    if (userId === req.user.id) {
      throw forbiddenError('The owner cannot be removed from their own board');
    }
    const member = await removeBoardMember(id, userId);
    sendSuccess(res, { id: member.id });
  } catch (e) {
    next(e);
  }
};

export default { create, list, getById, update, remove, getMembers, add, updateMember, removeMember };