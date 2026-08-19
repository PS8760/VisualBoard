import type { Socket } from 'socket.io';
import type { SocketEvents } from './socket.constants.js';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: number;
    userName: string;
    joinedBoards: Set<number>;
  };
}

export type BoardUsersPayload = Array<{
  id: string;
  userId: number;
  name: string;
  color?: string;
}>;

export type CursorPayload = {
  boardId: number;
  x: number;
  y: number;
  tool: string;
};

export type ElementCreatePayload = {
  boardId: number;
  element: Record<string, unknown>;
};

export type ElementUpdatePayload = {
  boardId: number;
  id: string;
  patch: Record<string, unknown>;
};

export type ElementDeletePayload = {
  boardId: number;
  id: string;
};

export type CommentCreatePayload = {
  boardId: number;
  content: string;
  element_id?: string | null;
  x?: number | null;
  y?: number | null;
  clientId?: string | null;
};

export type CommentDeletePayload = {
  boardId: number;
  id: number;
};

export type SocketPayloads = {
  [SocketEvents.JOIN_BOARD]: { boardId: number };
  [SocketEvents.LEAVE_BOARD]: { boardId: number };
  [SocketEvents.CURSOR_UPDATE]: CursorPayload;
  [SocketEvents.ELEMENT_CREATED]: ElementCreatePayload;
  [SocketEvents.ELEMENT_UPDATED]: ElementUpdatePayload;
  [SocketEvents.ELEMENT_REMOVED]: ElementDeletePayload;
  [SocketEvents.COMMENT_CREATED]: CommentCreatePayload;
  [SocketEvents.COMMENT_REMOVED]: CommentDeletePayload;
};

export default {};
