import prisma from '../../config/prisma.js';
import { AppError, conflictError, notFoundError } from '../../utils/errors.js';
import { publicAvatar } from '../user/user.service.js';
import type { Board, BoardMember } from './board.types.js';

export const createBoard = async (ownerId: number, title: string, description?: string | null) => {
  return prisma.$transaction(async (tx) => {
    const board = await tx.boards.create({
      data: { title, description: description ?? null, owner_id: ownerId },
    });
    await tx.board_members.create({
      data: { board_id: board.id, user_id: ownerId, role: 'owner' },
    });
    // create initial artifacts: a welcome document, an initial version snapshot, and a welcome comment
    await tx.documents.create({
      data: {
        board_id: board.id,
        element_id: null,
        user_id: ownerId,
        original_name: 'Welcome.txt',
        stored_name: `welcome-${board.id}-${Date.now()}.txt`,
        mime_type: 'text/plain',
        size: 0,
      },
    });
    await tx.versions.create({
      data: {
        board_id: board.id,
        snapshot: { elements: [] },
        created_by: ownerId,
      },
    });
    await tx.comments.create({
      data: {
        board_id: board.id,
        user_id: ownerId,
        content: 'Welcome to your new board — start by adding elements!',
        element_id: null,
      },
    });
    return board;
  });
};

export const getBoardById = async (id: number) => {
  const board = await prisma.boards.findUnique({
    where: { id },
    include: {
      board_members: {
        include: { users: { select: { id: true, name: true, email: true, avatar: true, updated_at: true } } },
      },
      elements: { orderBy: { created_at: 'asc' } },
      _count: { select: { comments: true, elements: true, documents: true } },
    },
  });
  if (!board) return null;
  return {
    ...board,
    board_members: board.board_members.map((m) => ({ ...m, users: { ...m.users, avatar: publicAvatar(m.users) } })),
  };
};

/** Boards the user owns or is a member of. */
export const listBoardsForUser = async (userId: number) => {
  const memberships = await prisma.board_members.findMany({
    where: { user_id: userId },
    include: { boards: { include: { _count: { select: { elements: true, comments: true, documents: true } } } } },
    orderBy: { boards: { updated_at: 'desc' } },
  });
  return memberships.map((m) => ({ ...m.boards, role: m.role, member_since: m.created_at }));
};

export const updateBoard = async (
  id: number,
  data: { title?: string; description?: string | null },
): Promise<Board> => {
  const board = await prisma.boards.update({
    where: { id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    },
  });
  return board;
};

export const deleteBoard = async (id: number) => {
  const docs = await prisma.documents.findMany({ where: { board_id: id } });
  return prisma.$transaction(async (tx) => {
    await tx.boards.delete({ where: { id } });
    return docs.map((d) => d.stored_name);
  });
};

/* ------------------------------------------------------------------ */
/* Members                                                             */
/* ------------------------------------------------------------------ */

export const listMembers = async (boardId: number): Promise<Array<BoardMember & { user: { id: number; name: string; email: string; avatar: string | null } }>> => {
  const members = await prisma.board_members.findMany({
    where: { board_id: boardId },
    include: { users: { select: { id: true, name: true, email: true, avatar: true, updated_at: true } } },
  });
  return members.map((m) => ({ ...m, user: { ...m.users, avatar: publicAvatar(m.users) } }));
};

export const addMember = async (boardId: number, userId: number, role: 'editor' | 'viewer') => {
  const userExists = await prisma.users.findUnique({ where: { id: userId } });
  if (!userExists) throw notFoundError('User not found');

  const existing = await prisma.board_members.findUnique({
    where: { user_id_board_id: { user_id: userId, board_id: boardId } },
  });
  if (existing) throw conflictError('User is already a member of this board');

  return prisma.board_members.create({ data: { board_id: boardId, user_id: userId, role } });
};

export const updateMemberRole = async (boardId: number, userId: number, role: 'owner' | 'editor' | 'viewer') => {
  const member = await prisma.board_members.findUnique({
    where: { user_id_board_id: { user_id: userId, board_id: boardId } },
  });
  if (!member) throw notFoundError('Member not found');

  if (role !== 'owner') {
    const owners = await prisma.board_members.count({
      where: { board_id: boardId, role: 'owner' },
    });
    if (member.role === 'owner' && owners <= 1) {
      throw new AppError(409, 'LAST_OWNER', 'A board must keep at least one owner');
    }
  }

  return prisma.board_members.update({
    where: { id: member.id },
    data: { role },
  });
};

export const removeMember = async (boardId: number, userId: number) => {
  const member = await prisma.board_members.findUnique({
    where: { user_id_board_id: { user_id: userId, board_id: boardId } },
  });
  if (!member) throw notFoundError('Member not found');

  if (member.role === 'owner') {
    const owners = await prisma.board_members.count({
      where: { board_id: boardId, role: 'owner' },
    });
    if (owners <= 1) {
      throw new AppError(409, 'LAST_OWNER', 'A board must keep at least one owner');
    }
  }

  await prisma.board_members.delete({ where: { id: member.id } });
  return member;
};

export default { createBoard, getBoardById, listBoardsForUser, updateBoard, deleteBoard, listMembers, addMember, updateMemberRole, removeMember };