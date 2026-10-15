import prisma from '../../config/prisma.js';
import { notFoundError, forbiddenError, badRequestError } from '../../utils/errors.js';
import { publicAvatar } from '../user/user.service.js';
import { emitToBoard } from '../socket/socket.bus.js';
import { SocketEvents } from '../socket/socket.constants.js';

const authorSelect = { id: true, name: true, email: true, avatar: true, updated_at: true } as const;

type CommentWithAuthor = Awaited<ReturnType<typeof findWithAuthor>>;

function findWithAuthor(id: number) {
  return prisma.comments.findUnique({ where: { id }, include: { users: { select: authorSelect } } });
}

function present<T extends { users: { avatar: string | null; id: number; updated_at: Date | null } }>(c: T) {
  return { ...c, users: { ...c.users, avatar: publicAvatar(c.users) } };
}

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
  const row = await prisma.comments.create({
    data: {
      board_id: boardId,
      user_id: userId,
      content,
      element_id: meta?.element_id ?? null,
      x_position: meta?.x ?? null,
      y_position: meta?.y ?? null,
    },
    include: { users: { select: authorSelect } },
  });
  return present(row);
};

export const listCommentsByBoard = async (boardId: number) => {
  const rows = await prisma.comments.findMany({
    where: { board_id: boardId },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
    include: { users: { select: authorSelect } },
  });
  return rows.map(present);
};

export const getCommentById = async (id: number) => {
  return prisma.comments.findUnique({ where: { id } });
};

/** Every mutation is scoped to the board in the URL — ids from other boards 404. */
async function getScoped(boardId: number, id: number) {
  const existing = await getCommentById(id);
  if (!existing || existing.board_id !== boardId) throw notFoundError('Comment not found');
  return existing;
}

export const updateComment = async (boardId: number, id: number, userId: number, content: string) => {
  const existing = await getScoped(boardId, id);
  if (existing.user_id !== userId) throw forbiddenError('Only the author can modify this comment');
  const row = await prisma.comments.update({
    where: { id },
    data: { content },
    include: { users: { select: authorSelect } },
  });
  return present(row);
};

export const deleteComment = async (boardId: number, id: number, userId: number, isOwner: boolean) => {
  const existing = await getScoped(boardId, id);
  if (existing.user_id !== userId && !isOwner) {
    throw forbiddenError('Only the author or a board owner can delete this comment');
  }
  await prisma.comments.delete({ where: { id } });
  return existing;
};

/** Notifies the room about threads that lost their element anchor. */
export const broadcastUnpinnedComments = async (boardId: number, ids: number[]) => {
  for (const id of ids) {
    const comment: CommentWithAuthor = await findWithAuthor(id);
    if (comment) emitToBoard(boardId, SocketEvents.COMMENT_UPDATED, { boardId, comment: present(comment) });
  }
};

export default { createComment, listCommentsByBoard, getCommentById, updateComment, deleteComment, broadcastUnpinnedComments };
