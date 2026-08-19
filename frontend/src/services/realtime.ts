import { usePresenceStore } from '../stores/usePresenceStore';
import { useBoardStore } from '../stores/useBoardStore';
import { mapComment, type BackendComment } from '../api/comment.api';
import type { BoardElement } from '../types';

export const REALTIME_EVENTS = {
  join: 'board:join',
  users: 'board:users',
  userJoin: 'user:join',
  userLeave: 'user:leave',
  cursor: 'cursor:update',
  elementCreated: 'element:created',
  elementUpdated: 'element:updated',
  elementRemoved: 'element:removed',
  commentCreated: 'comment:created',
  commentRemoved: 'comment:removed',
} as const;

type RealtimeEventName = typeof REALTIME_EVENTS[keyof typeof REALTIME_EVENTS];

interface SocketLike {
  on: (event: string, fn: (...args: unknown[]) => void) => void;
  off: (event: string, fn: (...args: unknown[]) => void) => void;
  emit: (event: string, payload: unknown) => void;
}

interface ElementCreatedPayload {
  boardId: string | number;
  element: BoardElement;
}

interface ElementUpdatedPayload {
  boardId: string | number;
  id: string;
  patch?: Partial<BoardElement>;
  element?: BoardElement;
}

interface ElementRemovedPayload {
  boardId: string | number;
  id: string;
}

interface CommentCreatedPayload {
  boardId: string | number;
  comment: BackendComment;
  clientId?: string | null;
}

interface CommentRemovedPayload {
  boardId: string | number;
  id: string | number;
}

function isCurrentBoard(boardId: string | number): boolean {
  return useBoardStore.getState().board?.id === String(boardId);
}

/**
 * Wires socket.io events to the board store.
 * Runs in "simulated" mode when the realtime server is unavailable,
 * so the collaboration UI always behaves consistently.
 */
export function attachRealtimeListeners() {
  let detachSocket = wireSocket(usePresenceStore.getState().socket);
  const unsubscribe = usePresenceStore.subscribe((state, previous) => {
    if (state.socket === previous.socket) return;
    detachSocket();
    detachSocket = wireSocket(state.socket);
  });

  return () => {
    detachSocket();
    unsubscribe();
  };
}

function wireSocket(socket: unknown) {
  if (!socket) return () => {};

  const s = socket as SocketLike;

  const onElementCreated = (...args: unknown[]) => {
    const payload = args[0] as ElementCreatedPayload;
    if (!payload?.element || !isCurrentBoard(payload.boardId)) return;
    const element = payload.element;
    useBoardStore.getState().addElement(element, { remote: true });
  };
  const onElementUpdated = (...args: unknown[]) => {
    const payload = args[0] as ElementUpdatedPayload;
    if (!payload?.id || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().updateElement(payload.id, payload.element ?? payload.patch ?? {}, { remote: true });
  };
  const onElementRemoved = (...args: unknown[]) => {
    const payload = args[0] as ElementRemovedPayload;
    if (!payload?.id || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().removeElements([payload.id], { remote: true });
  };
  const onCommentCreated = (...args: unknown[]) => {
    const payload = args[0] as CommentCreatedPayload;
    if (!payload?.comment || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().upsertComment(mapComment(payload.comment), { clientId: payload.clientId ?? undefined });
  };
  const onCommentRemoved = (...args: unknown[]) => {
    const payload = args[0] as CommentRemovedPayload;
    if (!payload?.id || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().removeComment(String(payload.id), { remote: true });
  };

  s.on(REALTIME_EVENTS.elementCreated, onElementCreated);
  s.on(REALTIME_EVENTS.elementUpdated, onElementUpdated);
  s.on(REALTIME_EVENTS.elementRemoved, onElementRemoved);
  s.on(REALTIME_EVENTS.commentCreated, onCommentCreated);
  s.on(REALTIME_EVENTS.commentRemoved, onCommentRemoved);

  return () => {
    s.off(REALTIME_EVENTS.elementCreated, onElementCreated);
    s.off(REALTIME_EVENTS.elementUpdated, onElementUpdated);
    s.off(REALTIME_EVENTS.elementRemoved, onElementRemoved);
    s.off(REALTIME_EVENTS.commentCreated, onCommentCreated);
    s.off(REALTIME_EVENTS.commentRemoved, onCommentRemoved);
  };
}

/** Emits element changes to other clients over the socket. */
export function emitElementEvent(event: RealtimeEventName, payload: unknown): boolean {
  const { socket, mode } = usePresenceStore.getState();
  if (mode !== 'live' || !socket) return false;
  (socket as SocketLike).emit(event, payload);
  return true;
}
