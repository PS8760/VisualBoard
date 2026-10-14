import type { Server } from 'socket.io';

/**
 * Process-wide handle on the socket.io server so REST controllers can fan out
 * realtime events (comment created over HTTP, version restored, …) to the
 * board room. With the Redis adapter configured, emits reach every instance.
 *
 * All functions are no-ops until `bindRealtime` is called, which keeps the
 * HTTP app usable (and testable) without a socket server.
 */
let io: Server | null = null;

export const roomOf = (boardId: number) => `board:${boardId}`;

export function bindRealtime(server: Server) {
  io = server;
}

export function getRealtime(): Server | null {
  return io;
}

/**
 * Emits to everyone in the board room. Pass `exceptSocketId` to skip the
 * originating connection when it already applied the change optimistically.
 */
export function emitToBoard(boardId: number, event: string, payload: unknown, exceptSocketId?: string) {
  if (!io) return;
  const target = exceptSocketId ? io.to(roomOf(boardId)).except(exceptSocketId) : io.to(roomOf(boardId));
  target.emit(event, payload);
}

export default { bindRealtime, getRealtime, emitToBoard, roomOf };
