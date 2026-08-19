import { Server } from 'socket.io';
import { SocketEvents } from './socket.constants.js';
import { boardUsers, broadcastUserJoin, broadcastUserLeave, roomOf } from './socket.events.js';
import {
  joinBoardSchema,
  cursorUpdateSchema,
  elementCreateSchema,
  elementUpdateSchema,
  elementDeleteSchema,
  commentCreateSchema,
} from './socket.validation.js';
import { getBoardRole } from '../../services/rbac.js';
import {
  createElement,
  updateElement,
  deleteElement,
} from '../element/element.service.js';
import { createComment } from '../comment/comment.service.js';
import { logger } from '../../utils/logger.js';
import type { AuthenticatedSocket } from './socket.types.js';

export const handleConnection = (io: Server, socket: AuthenticatedSocket) => {
  const { userId } = socket.data;

  socket.on(SocketEvents.JOIN_BOARD, async (raw: unknown) => {
    const parsed = joinBoardSchema.safeParse(raw);
    if (!parsed.success) return socket.emit(SocketEvents.ERROR, { message: 'Invalid board:join payload' });

    const { boardId } = parsed.data;
    const role = await getBoardRole(userId, boardId).catch(() => null);
    if (!role) {
      return socket.emit(SocketEvents.ERROR, { message: 'You do not have access to this board' });
    }

    socket.data.joinedBoards.add(boardId);
    await socket.join(roomOf(boardId));
    broadcastUserJoin(io, boardId, socket);
    socket.emit(SocketEvents.BOARD_USERS, boardUsers(io, boardId));
  });

  socket.on(SocketEvents.LEAVE_BOARD, (raw: unknown) => {
    const parsed = joinBoardSchema.safeParse(raw);
    if (!parsed.success) return;
    const { boardId } = parsed.data;
    leaveBoardRoom(io, socket, boardId);
  });

  // 20Hz ceiling per socket: cursors are cosmetic, drop excess traffic.
  let lastCursorAt = 0;
  socket.on(SocketEvents.CURSOR_UPDATE, (raw: unknown) => {
    const now = Date.now();
    if (now - lastCursorAt < 50) return;
    lastCursorAt = now;

    const parsed = cursorUpdateSchema.safeParse(raw);
    if (!parsed.success) return;
    const { boardId, x, y, tool } = parsed.data;
    if (!socket.data.joinedBoards.has(boardId)) return;
    socket.to(roomOf(boardId)).emit(SocketEvents.CURSOR_UPDATE, {
      id: socket.id,
      userId,
      x,
      y,
      tool: tool ?? 'select',
    });
  });

  socket.on(SocketEvents.ELEMENT_CREATED, async (raw: unknown) => {
    const parsed = elementCreateSchema.safeParse(raw);
    if (!parsed.success) return socket.emit(SocketEvents.ERROR, { message: 'Invalid element:create payload' });

    const { boardId, element } = parsed.data;
    const role = await getBoardRole(userId, boardId).catch(() => null);
    if (!role || role === 'viewer') {
      return socket.emit(SocketEvents.ERROR, { message: 'Insufficient permissions' });
    }

    try {
      const row = await createElement(boardId, element, String(element.id ?? crypto.randomUUID()));
      io.to(roomOf(boardId)).emit(SocketEvents.ELEMENT_CREATED, { boardId, element: row.element_data });
    } catch (err) {
      logger.warn({ err, boardId }, 'socket element:create failed');
      socket.emit(SocketEvents.ERROR, { message: 'Element could not be saved' });
    }
  });

  socket.on(SocketEvents.ELEMENT_UPDATED, async (raw: unknown) => {
    const parsed = elementUpdateSchema.safeParse(raw);
    if (!parsed.success) return socket.emit(SocketEvents.ERROR, { message: 'Invalid element:update payload' });

    const { boardId, id, patch } = parsed.data;
    const role = await getBoardRole(userId, boardId).catch(() => null);
    if (!role || role === 'viewer') {
      return socket.emit(SocketEvents.ERROR, { message: 'Insufficient permissions' });
    }

    try {
      const row = await updateElement(id, patch);
      if (row.board_id !== boardId) {
        return socket.emit(SocketEvents.ERROR, { message: 'Element does not belong to this board' });
      }
      io.to(roomOf(boardId)).emit(SocketEvents.ELEMENT_UPDATED, { boardId, id, patch });
    } catch (err) {
      logger.warn({ err, boardId, id }, 'socket element:update failed');
      socket.emit(SocketEvents.ERROR, { message: 'Element could not be updated' });
    }
  });

  socket.on(SocketEvents.ELEMENT_REMOVED, async (raw: unknown) => {
    const parsed = elementDeleteSchema.safeParse(raw);
    if (!parsed.success) return socket.emit(SocketEvents.ERROR, { message: 'Invalid element:delete payload' });

    const { boardId, id } = parsed.data;
    const role = await getBoardRole(userId, boardId).catch(() => null);
    if (!role || role === 'viewer') {
      return socket.emit(SocketEvents.ERROR, { message: 'Insufficient permissions' });
    }

    try {
      await deleteElement(id);
      io.to(roomOf(boardId)).emit(SocketEvents.ELEMENT_REMOVED, { boardId, id });
    } catch {
      socket.emit(SocketEvents.ERROR, { message: 'Element could not be deleted' });
    }
  });

  socket.on(SocketEvents.COMMENT_CREATED, async (raw: unknown) => {
    const parsed = commentCreateSchema.safeParse(raw);
    if (!parsed.success) return socket.emit(SocketEvents.ERROR, { message: 'Invalid comment:create payload' });

    const { boardId, content, element_id, x, y } = parsed.data;
    const role = await getBoardRole(userId, boardId).catch(() => null);
    if (!role) {
      return socket.emit(SocketEvents.ERROR, { message: 'You do not have access to this board' });
    }

    try {
      const comment = await createComment(boardId, userId, content, { element_id, x, y });
      io.to(roomOf(boardId)).emit(SocketEvents.COMMENT_CREATED, { boardId, comment });
    } catch (err) {
      logger.warn({ err, boardId }, 'socket comment:create failed');
      socket.emit(SocketEvents.ERROR, { message: 'Comment could not be saved' });
    }
  });

  socket.on(SocketEvents.DISCONNECT, () => {
    socket.data.joinedBoards.forEach((boardId) => {
      leaveBoardRoom(io, socket, boardId);
    });
  });
};

function leaveBoardRoom(io: Server, socket: AuthenticatedSocket, boardId: number) {
  socket.data.joinedBoards.delete(boardId);
  socket.leave(roomOf(boardId));
  broadcastUserLeave(io, boardId, socket.id);
}

export default handleConnection;