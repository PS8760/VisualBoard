import prisma from '../../config/prisma.js';
import { notFoundError, forbiddenError, badRequestError } from '../../utils/errors.js';
import { publicAvatar } from '../user/user.service.js';

export const createComment = async (
  boardId: number,
  userId: number,
  content: string,
  meta?: { element_id?: string | null; x?: number | null; y?: number | null },
) => {
  if (meta?.element_id) {
    const element = await prisma.elements.findUnique({
      where: { id: meta.element_id },
      select: { board_id: true },
    });
    if (!element) throw badRequestError('Referenced element does not exist');
    if (element.board_id !== boardId) throw badRequestError('Referenced element belongs to another board');
  }
  return prisma.comments.create({
    data: {
      board_id: boardId,
      user_id: userId,
      content,
      element_id: meta?.element_id ?? null,
      x_position: meta?.x ?? null,
      y_position: meta?.y ?? null,
    },
  });
};

export const listCommentsByBoard = async (boardId: number) => {
  const rows = await prisma.comments.findMany({
    where: { board_id: boardId },
    orderBy: { created_at: 'asc' },
    include: { users: { select: { id: true, name: true, email: true, avatar: true, updated_at: true } } },
  });
  return rows.map((c) => ({
    ...c,
    users: { ...c.users, avatar: publicAvatar(c.users) },
  }));
};

export const getCommentById = async (id: number) => {
  return prisma.comments.findUnique({ where: { id } });
};

export const updateComment = async (id: number, userId: number, content: string) => {
  const existing = await getCommentById(id);
  if (!existing) throw notFoundError('Comment not found');
  if (existing.user_id !== userId) throw forbiddenError('Only the author can modify this comment');
  return prisma.comments.update({ where: { id }, data: { content } });
};

export const deleteComment = async (id: number, userId: number, isOwner: boolean) => {
  const existing = await getCommentById(id);
  if (!existing) throw notFoundError('Comment not found');
  if (existing.user_id !== userId && !isOwner) {
    throw forbiddenError('Only the author or a board owner can delete this comment');
  }
  await prisma.comments.delete({ where: { id } });
  return existing;
};

export default { createComment, listCommentsByBoard, getCommentById, updateComment, deleteComment };