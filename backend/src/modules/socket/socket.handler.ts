import { Server } from 'socket.io';
import type { ZodType } from 'zod';
import { SocketEvents } from './socket.constants.js';
import { boardUsers, broadcastUserJoin, broadcastUserLeave, roomOf } from './socket.events.js';
import {
  joinBoardSchema,
  cursorUpdateSchema,
  elementCreateSchema,
  elementUpdateSchema,
  elementDeleteSchema,
  elementPreviewSchema,
  commentCreateSchema,
  commentDeleteSchema,
} from './socket.validation.js';
import { getBoardRole, ROLE_WEIGHT, type BoardRole } from '../../services/rbac.js';
import { createElement, updateElement, deleteElement } from '../element/element.service.js';
import { createComment, deleteComment, broadcastUnpinnedComments } from '../comment/comment.service.js';
import { isAppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { uid } from '../../utils/id.js';
import type { AuthenticatedSocket, AckResponse, AckErrorCode } from './socket.types.js';

/** Role lookups are cached briefly: drags emit many writes per second. */
const ROLE_TTL_MS = 5_000;

type Ack = (res: AckResponse) => void;

const asAck = (maybe: unknown): Ack | null => (typeof maybe === 'function' ? (maybe as Ack) : null);

export const handleConnection = (io: Server, socket: AuthenticatedSocket) => {
  const { userId } = socket.data;
  const roleCache = new Map<number, { role: BoardRole | null; at: number }>();

  const roleFor = async (boardId: number, fresh = false): Promise<BoardRole | null> => {
    const cached = roleCache.get(boardId);
    if (!fresh && cached && Date.now() - cached.at < ROLE_TTL_MS) return cached.role;
    const role = await getBoardRole(userId, boardId).catch(() => null);
    roleCache.set(boardId, { role, at: Date.now() });
    return role;
  };

  /** Replies through the ack when present, else the legacy `error` event. */
  const fail = (ack: Ack | null, code: AckErrorCode, message: string) => {
    if (ack) ack({ ok: false, code, message });
    else socket.emit(SocketEvents.ERROR, { code, message });
  };

  /**
   * Shared envelope for every mutating event: validate → authorize → run →
   * ack. A thrown AppError maps to its code so clients can roll back precisely.
   */
  function mutation<T extends { boardId: number }>(
    event: string,
    schema: ZodType<T>,
    minRole: BoardRole,
    run: (data: T) => Promise<AckResponse>,
  ) {
    socket.on(event, async (raw: unknown, maybeAck?: unknown) => {
      const ack = asAck(maybeAck);
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return fail(ack, 'VALIDATION_ERROR', `Invalid ${event} payload`);
      }
      const data = parsed.data;
      if (!socket.data.joinedBoards.has(data.boardId)) {
        return fail(ack, 'NOT_JOINED', 'Join the board before sending changes');
      }
      const role = await roleFor(data.boardId);
      if (!role || ROLE_WEIGHT[role] < ROLE_WEIGHT[minRole]) {
        return fail(ack, 'FORBIDDEN', 'Insufficient permissions');
      }
      try {
        const res = await run(data);
        ack?.(res);
      } catch (err) {
        if (isAppError(err)) {
          return fail(ack, err.status === 404 ? 'NOT_FOUND' : err.status === 409 ? 'CONFLICT' : 'REJECTED', err.message);
        }
        logger.warn({ err, event, boardId: data.boardId }, 'socket mutation failed');
        fail(ack, 'INTERNAL', 'The change could not be saved');
      }
    });
  }

  socket.on(SocketEvents.JOIN_BOARD, async (raw: unknown, maybeAck?: unknown) => {
    const ack = asAck(maybeAck);
    const parsed = joinBoardSchema.safeParse(raw);
    if (!parsed.success) return fail(ack, 'VALIDATION_ERROR', 'Invalid board:join payload');

    const { boardId } = parsed.data;
    const role = await roleFor(boardId, true);
    if (!role) return fail(ack, 'FORBIDDEN', 'You do not have access to this board');

    const alreadyJoined = socket.data.joinedBoards.has(boardId);
    socket.data.joinedBoards.add(boardId);
    await socket.join(roomOf(boardId));
    if (!alreadyJoined) broadcastUserJoin(boardId, socket);
    const users = boardUsers(io, boardId);
    socket.emit(SocketEvents.BOARD_USERS, users);
    ack?.({ ok: true, role, users });
  });

  socket.on(SocketEvents.LEAVE_BOARD, (raw: unknown) => {
    const parsed = joinBoardSchema.safeParse(raw);
    if (!parsed.success) return;
    leaveBoardRoom(io, socket, parsed.data.boardId);
  });

  // 20Hz ceiling per socket: cursors are cosmetic, drop excess traffic.
  let lastCursorAt = 0;
  socket.on(SocketEvents.CURSOR_UPDATE, (raw: unknown) => {
    const now = Date.now();
    if (now - lastCursorAt < 45) return;
    lastCursorAt = now;

    const parsed = cursorUpdateSchema.safeParse(raw);
    if (!parsed.success) return;
    const { boardId, x, y, tool } = parsed.data;
    if (!socket.data.joinedBoards.has(boardId)) return;
    // volatile: a dropped cursor frame is fine, a buffered backlog is not.
    socket.volatile.to(roomOf(boardId)).emit(SocketEvents.CURSOR_UPDATE, {
      id: socket.id,
      userId,
      x,
      y,
      tool: tool ?? 'select',
    });
  });

  // ~30Hz ceiling for live drag previews; the final frame is always relayed.
  let lastPreviewAt = 0;
  socket.on(SocketEvents.ELEMENT_PREVIEW, async (raw: unknown) => {
    const parsed = elementPreviewSchema.safeParse(raw);
    if (!parsed.success) return;
    const now = Date.now();
    if (!parsed.data.end && now - lastPreviewAt < 30) return;
    lastPreviewAt = now;
    const { boardId } = parsed.data;
    if (!socket.data.joinedBoards.has(boardId)) return;
    const role = await roleFor(boardId);
    if (!role || role === 'viewer') return;
    socket.volatile.to(roomOf(boardId)).emit(SocketEvents.ELEMENT_PREVIEW, { ...parsed.data, by: socket.id });
  });

  mutation(SocketEvents.ELEMENT_CREATED, elementCreateSchema, 'editor', async ({ boardId, element }) => {
    const id = typeof element.id === 'string' && element.id ? element.id : uid('el');
    const row = await createElement(boardId, element, id, { userId });
    socket.to(roomOf(boardId)).emit(SocketEvents.ELEMENT_CREATED, { boardId, element: row.element_data, by: socket.id });
    return { ok: true, element: row.element_data };
  });

  mutation(SocketEvents.ELEMENT_UPDATED, elementUpdateSchema, 'editor', async ({ boardId, id, patch }) => {
    const row = await updateElement(boardId, id, patch, { userId });
    // Ship the authoritative merged row (not just the patch): receivers apply it
    // by version, so out-of-order delivery can never drop a concurrent edit.
    socket.to(roomOf(boardId)).emit(SocketEvents.ELEMENT_UPDATED, { boardId, id, element: row.element_data, by: socket.id });
    return { ok: true, element: row.element_data };
  });

  mutation(SocketEvents.ELEMENT_REMOVED, elementDeleteSchema, 'editor', async ({ boardId, id }) => {
    const { deleted, unpinnedCommentIds } = await deleteElement(boardId, id, { userId });
    if (deleted) {
      socket.to(roomOf(boardId)).emit(SocketEvents.ELEMENT_REMOVED, { boardId, id, by: socket.id });
      await broadcastUnpinnedComments(boardId, unpinnedCommentIds);
    }
    // Idempotent: deleting something already gone is a success.
    return { ok: true };
  });

  mutation(SocketEvents.COMMENT_CREATED, commentCreateSchema, 'viewer', async ({ boardId, content, element_id, x, y, clientId }) => {
    const comment = await createComment(boardId, userId, content, { element_id, x, y });
    io.to(roomOf(boardId)).emit(SocketEvents.COMMENT_CREATED, { boardId, comment, clientId });
    return { ok: true, comment };
  });

  mutation(SocketEvents.COMMENT_REMOVED, commentDeleteSchema, 'viewer', async ({ boardId, id }) => {
    const role = await roleFor(boardId);
    await deleteComment(boardId, id, userId, role === 'owner');
    io.to(roomOf(boardId)).emit(SocketEvents.COMMENT_REMOVED, { boardId, id });
    return { ok: true };
  });

  socket.on(SocketEvents.DISCONNECT, () => {
    socket.data.joinedBoards.forEach((boardId) => {
      leaveBoardRoom(io, socket, boardId);
    });
  });
};

function leaveBoardRoom(io: Server, socket: AuthenticatedSocket, boardId: number) {
  if (!socket.data.joinedBoards.delete(boardId)) return;
  socket.leave(roomOf(boardId));
  broadcastUserLeave(io, boardId, socket.id);
}

export default handleConnection;
