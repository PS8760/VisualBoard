import prisma from '../config/prisma.js';
import { AppError, forbiddenError, notFoundError } from '../utils/errors.js';
import type { JwtPayload } from '../utils/jwt.js';

export type BoardRole = 'owner' | 'editor' | 'viewer';

export const ROLE_WEIGHT: Record<BoardRole, number> = { viewer: 1, editor: 2, owner: 3 };

/** Resolves the caller's role on a board, or null when they are not a member. */
export async function getBoardRole(userId: number, boardId: number): Promise<BoardRole | null> {
  const membership = await prisma.board_members.findUnique({
    where: { user_id_board_id: { user_id: userId, board_id: boardId } },
  });
  if (membership) return membership.role as BoardRole;
  return null;
}

/** Throws 403 unless the caller has at least the required role. */
export async function assertBoardRole(
  user: JwtPayload,
  boardId: number,
  required: BoardRole,
): Promise<BoardRole> {
  const role = await getBoardRole(user.id, boardId);
  if (!role || ROLE_WEIGHT[role] < ROLE_WEIGHT[required]) {
    throw forbiddenError();
  }
  return role;
}

/** Throws 404 when the board does not exist; returns the board otherwise. */
export async function requireBoard(boardId: number) {
  const board = await prisma.boards.findUnique({ where: { id: boardId } });
  if (!board) throw notFoundError('Board not found');
  return board;
}

/** Checks the board exists and the caller is a member (any role). */
export async function assertBoardAccess(user: JwtPayload, boardId: number): Promise<BoardRole> {
  await requireBoard(boardId);
  const role = await getBoardRole(user.id, boardId);
  if (!role) throw new AppError(403, 'FORBIDDEN', 'You do not have access to this board');
  return role;
}

export default { getBoardRole, assertBoardRole, assertBoardAccess, requireBoard, ROLE_WEIGHT };
