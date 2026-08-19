import { usePresenceStore } from '../stores/usePresenceStore';
import { useBoardStore } from '../stores/useBoardStore';
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
} as const;

/**
 * Wires socket.io events to the board store.
 * Runs in "simulated" mode when the realtime server is unavailable,
 * so the collaboration UI always behaves consistently.
 */
export function attachRealtimeListeners() {
  const { socket } = usePresenceStore.getState();
  if (!socket) return () => {};

  const s = socket as {
    on: (e: string, fn: (...args: unknown[]) => void) => void;
    off: (e: string, fn: (...args: unknown[]) => void) => void;
  };

  const onElementCreated = (...args: unknown[]) => {
    const element = args[0] as BoardElement;
    useBoardStore.getState().addElement(element, { remote: true });
  };
  const onElementUpdated = (...args: unknown[]) => {
    const { id, patch } = args[0] as { id: string; patch: Partial<BoardElement> };
    useBoardStore.getState().updateElement(id, patch, { remote: true });
  };
  const onElementRemoved = (...args: unknown[]) => {
    const { id } = args[0] as { id: string };
    useBoardStore.getState().removeElements([id], { remote: true });
  };
  const onCommentCreated = (...args: unknown[]) => {
    const { comment } = args[0] as { comment: unknown };
    if (!comment) return;
    // append comment without re-emitting
    const c = comment as any;
    useBoardStore.getState().setComments?.(null); // noop if not present; fallback below
    // fallback: directly set store state
    useBoardStore.setState((s) => ({ comments: [...s.comments, c] }));
  };

  s.on(REALTIME_EVENTS.elementCreated, onElementCreated);
  s.on(REALTIME_EVENTS.elementUpdated, onElementUpdated);
  s.on(REALTIME_EVENTS.elementRemoved, onElementRemoved);
  s.on(REALTIME_EVENTS.commentCreated, onCommentCreated);

  return () => {
    s.off(REALTIME_EVENTS.elementCreated, onElementCreated);
    s.off(REALTIME_EVENTS.elementUpdated, onElementUpdated);
    s.off(REALTIME_EVENTS.elementRemoved, onElementRemoved);
  };
}

/** Emits element changes to other clients over the socket. */
export function emitElementEvent(event: keyof typeof REALTIME_EVENTS, payload: unknown) {
  const { socket, mode } = usePresenceStore.getState();
  if (mode !== 'live' || !socket) return;
  (socket as { emit: (e: string, p: unknown) => void }).emit(event, payload);
}
