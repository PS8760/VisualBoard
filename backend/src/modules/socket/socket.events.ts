import { Server } from 'socket.io';
import { SocketEvents } from './socket.constants.js';
import { roomOf } from './socket.bus.js';
import type { AuthenticatedSocket } from './socket.types.js';

export { roomOf };

/**
 * Connections currently present in a board room. Presence is keyed by socket
 * id (one entry per tab) so join/leave/cursor events always refer to the same
 * key; clients collapse multiple tabs of one user for display.
 */
export function boardUsers(io: Server, boardId: number) {
  const sockets = io.sockets.adapter.rooms.get(roomOf(boardId));
  if (!sockets) return [];
  const users: Array<{ id: string; userId: number; name: string }> = [];
  for (const socketId of sockets) {
    const socket = io.sockets.sockets.get(socketId) as AuthenticatedSocket | undefined;
    if (!socket) continue;
    users.push({ id: socketId, userId: socket.data.userId, name: socket.data.userName });
  }
  return users;
}

export const broadcastUserJoin = (boardId: number, socket: AuthenticatedSocket) => {
  socket.to(roomOf(boardId)).emit(SocketEvents.USER_JOIN, {
    id: socket.id,
    userId: socket.data.userId,
    name: socket.data.userName,
  });
};

export const broadcastUserLeave = (io: Server, boardId: number, socketId: string) => {
  io.to(roomOf(boardId)).emit(SocketEvents.USER_LEAVE, { id: socketId });
};

export default { roomOf, boardUsers, broadcastUserJoin, broadcastUserLeave };
