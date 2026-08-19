import { Server } from 'socket.io';
import { SocketEvents } from './socket.constants.js';
import type { AuthenticatedSocket } from './socket.types.js';

export const roomOf = (boardId: number) => `board:${boardId}`;

/** Users currently present in a board room (deduped by userId). */
export function boardUsers(io: Server, boardId: number) {
  const sockets = io.sockets.adapter.rooms.get(roomOf(boardId));
  const seen = new Map<number, { id: string; userId: number; name: string }>();
  if (!sockets) return [];
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket | undefined;
    if (!socket) continue;
    const { userId, userName } = socket.data;
    if (!seen.has(userId)) {
      seen.set(userId, { id: socketId, userId, name: userName });
    }
  }
  return [...seen.values()];
}

export const broadcastUserJoin = (io: Server, boardId: number, socket: AuthenticatedSocket) => {
  io.to(roomOf(boardId)).emit(SocketEvents.USER_JOIN, {
    id: socket.id,
    userId: socket.data.userId,
    name: socket.data.userName,
  });
};

export const broadcastUserLeave = (io: Server, boardId: number, socketId: string) => {
  io.to(roomOf(boardId)).emit(SocketEvents.USER_LEAVE, { id: socketId });
};

export default { roomOf, boardUsers, broadcastUserJoin, broadcastUserLeave };