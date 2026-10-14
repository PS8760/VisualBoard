import { toast } from 'sonner';
import { usePresenceStore } from '../stores/usePresenceStore';
import { useBoardStore } from '../stores/useBoardStore';
import { mapComment, type BackendComment } from '../api/comment.api';
import * as elementApi from '../api/element.api';
import type { BoardElement, SaveStatus } from '../types';

/**
 * Realtime sync engine.
 *
 * Local edits are applied optimistically to the board store and queued here
 * as granular operations (create / update / delete). The engine:
 *
 *  - coalesces bursts (typing, drag-end of many objects) per element,
 *  - keeps at most one in-flight operation per element so the server applies
 *    them in order, while different elements are sent concurrently,
 *  - waits for a server ACK carrying the authoritative row + version,
 *  - retries on ACK timeout (every operation is idempotent server-side),
 *  - rolls back to server truth when an operation is rejected,
 *  - queues while offline and, after reconnecting, rebases the pending queue
 *    on a fresh copy of the board before replaying it.
 *
 * Remote changes are applied by version: a broadcast older than what the
 * client already has is discarded, so out-of-order delivery can't regress state.
 */

export const REALTIME_EVENTS = {
  join: 'board:join',
  users: 'board:users',
  restored: 'board:restored',
  boardUpdated: 'board:updated',
  userJoin: 'user:join',
  userLeave: 'user:leave',
  cursor: 'cursor:update',
  elementCreated: 'element:created',
  elementUpdated: 'element:updated',
  elementRemoved: 'element:removed',
  elementPreview: 'element:preview',
  commentCreated: 'comment:created',
  commentUpdated: 'comment:updated',
  commentRemoved: 'comment:removed',
  versionCreated: 'version:created',
  error: 'error',
} as const;

export type ElementOp =
  | { type: 'create'; id: string; element: BoardElement }
  | { type: 'update'; id: string; patch: Partial<BoardElement> }
  | { type: 'delete'; id: string };

interface QueuedOp {
  seq: number;
  boardId: string;
  op: ElementOp;
  inflight: boolean;
  attempts: number;
}

interface AckResponse {
  ok: boolean;
  code?: string;
  message?: string;
  element?: BoardElement;
}

export interface ElementPreview {
  boardId: number | string;
  id: string;
  /** World-space center. */
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  end?: boolean;
  by?: string;
}

interface SocketLike {
  id?: string;
  connected: boolean;
  on: (event: string, fn: (...args: unknown[]) => void) => void;
  off: (event: string, fn: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
  timeout: (ms: number) => { emit: (event: string, payload: unknown, cb: (err: Error | null, res: AckResponse) => void) => void };
  volatile: { emit: (event: string, payload: unknown) => void };
}

const ACK_TIMEOUT_MS = 10_000;
const FLUSH_DELAY_MS = 40;
const MAX_RETRY_DELAY_MS = 15_000;

let queue: QueuedOp[] = [];
let seq = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let resyncTimer: ReturnType<typeof setTimeout> | null = null;
let resyncing = false;
const previewListeners = new Set<(p: ElementPreview) => void>();

const currentSocket = (): SocketLike | null => (usePresenceStore.getState().socket as SocketLike | null) ?? null;

function isLiveFor(boardId: string): boolean {
  const { socket, mode, joinedBoardId } = usePresenceStore.getState();
  return mode === 'live' && !!socket && (socket as SocketLike).connected && joinedBoardId === boardId;
}

function isCurrentBoard(boardId: string | number): boolean {
  return useBoardStore.getState().board?.id === String(boardId);
}

/* ------------------------------------------------------------------------ */
/* Outbox                                                                    */
/* ------------------------------------------------------------------------ */

/** Pending local state for an element, layered over any server version. */
export function pendingOverlay(id: string): { deleted: boolean; patch: Partial<BoardElement> | null } {
  let deleted = false;
  let patch: Partial<BoardElement> | null = null;
  for (const q of queue) {
    if (q.op.id !== id) continue;
    if (q.op.type === 'delete') {
      deleted = true;
      patch = null;
    } else if (q.op.type === 'create') {
      deleted = false;
      patch = { ...q.op.element };
    } else {
      patch = { ...(patch ?? {}), ...q.op.patch };
    }
  }
  return { deleted, patch };
}

export function pendingCount(boardId?: string): number {
  return boardId ? queue.filter((q) => q.boardId === boardId).length : queue.length;
}

export function enqueueElementOp(boardId: string, op: ElementOp) {
  // Merge into the newest unsent op for the same element where possible.
  let last: QueuedOp | undefined;
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i]!;
    if (q.boardId === boardId && q.op.id === op.id) {
      last = q;
      break;
    }
  }

  if (op.type === 'update' && last && !last.inflight) {
    if (last.op.type === 'update') {
      last.op = { ...last.op, patch: { ...last.op.patch, ...op.patch } };
      scheduleFlush();
      return;
    }
    if (last.op.type === 'create') {
      last.op = { ...last.op, element: { ...last.op.element, ...op.patch } };
      scheduleFlush();
      return;
    }
  }

  if (op.type === 'delete') {
    const unsent = queue.filter((q) => q.boardId === boardId && q.op.id === op.id && !q.inflight);
    const neverReachedServer =
      unsent.some((q) => q.op.type === 'create') &&
      !queue.some((q) => q.boardId === boardId && q.op.id === op.id && q.inflight);
    queue = queue.filter((q) => !unsent.includes(q));
    if (neverReachedServer) {
      updateSaveStatus();
      return;
    }
  }

  queue.push({ seq: ++seq, boardId, op, inflight: false, attempts: 0 });
  scheduleFlush();
}

function scheduleFlush(delay = FLUSH_DELAY_MS) {
  updateSaveStatus();
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, delay);
}

function payloadFor(q: QueuedOp) {
  const boardId = Number(q.boardId);
  switch (q.op.type) {
    case 'create': {
      const { version: _version, ...element } = q.op.element;
      void _version;
      return { event: REALTIME_EVENTS.elementCreated, payload: { boardId, element } };
    }
    case 'update': {
      const { version: _version, id: _id, ...patch } = q.op.patch;
      void _version;
      void _id;
      return { event: REALTIME_EVENTS.elementUpdated, payload: { boardId, id: q.op.id, patch } };
    }
    case 'delete':
      return { event: REALTIME_EVENTS.elementRemoved, payload: { boardId, id: q.op.id } };
  }
}

function flush() {
  const socket = currentSocket();
  const blocked = new Set<string>();
  for (const q of queue) {
    const key = `${q.boardId}:${q.op.id}`;
    // One in-flight op per element: later ops wait for the earlier ack.
    if (q.inflight || blocked.has(key)) {
      blocked.add(key);
      continue;
    }
    blocked.add(key);
    if (!socket || !isLiveFor(q.boardId)) continue;

    const { event, payload } = payloadFor(q);
    q.inflight = true;
    q.attempts += 1;
    socket.timeout(ACK_TIMEOUT_MS).emit(event, payload, (err, res) => onAck(q, err, res));
  }
  updateSaveStatus();
}

function onAck(q: QueuedOp, err: Error | null, res: AckResponse | undefined) {
  if (!queue.includes(q)) return; // superseded (restore / board switch)

  if (err || !res) {
    // Timed out: the server may or may not have applied it. Every op is
    // idempotent, so resend with backoff (or after reconnect).
    q.inflight = false;
    const delay = Math.min(1000 * 2 ** Math.min(q.attempts, 4), MAX_RETRY_DELAY_MS);
    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        flush();
      }, delay);
    }
    updateSaveStatus();
    return;
  }

  queue = queue.filter((x) => x !== q);

  if (res.ok) {
    if (res.element && isCurrentBoard(q.boardId)) {
      useBoardStore.getState().applyServerElement(res.element, { fromAck: true });
    }
  } else {
    handleRejection(q, res);
  }
  updateSaveStatus();
  scheduleFlush(0);
}

function handleRejection(q: QueuedOp, res: AckResponse) {
  const board = useBoardStore.getState();
  switch (res.code) {
    case 'NOT_FOUND':
      // Someone deleted it meanwhile: drop our pending edits and the element.
      queue = queue.filter((x) => !(x.boardId === q.boardId && x.op.id === q.op.id));
      if (isCurrentBoard(q.boardId)) board.removeElementLocal(q.op.id);
      return;
    case 'NOT_JOINED':
      // Room membership was lost (server restart): requeue and rejoin.
      queue.unshift({ ...q, inflight: false });
      usePresenceStore.getState().rejoin();
      return;
    case 'FORBIDDEN':
      queue = queue.filter((x) => x.boardId !== q.boardId);
      board.setCanEdit(false);
      toast.error('You no longer have edit access to this board', {
        id: 'vb-forbidden',
        description: 'Your unsaved changes were reverted.',
      });
      scheduleResync(q.boardId, 0);
      return;
    default:
      toast.error('A change could not be saved', { id: 'vb-rejected', description: res.message });
      // Roll back to server truth; other pending ops are rebased on top.
      scheduleResync(q.boardId, 0);
  }
}

/* ------------------------------------------------------------------------ */
/* Resync (reconnect / rollback)                                             */
/* ------------------------------------------------------------------------ */

export function scheduleResync(boardId: string, delay = 250) {
  if (resyncTimer) clearTimeout(resyncTimer);
  resyncTimer = setTimeout(() => {
    resyncTimer = null;
    void resync(boardId);
  }, delay);
}

async function resync(boardId: string) {
  if (resyncing) return scheduleResync(boardId, 500);
  if (!isCurrentBoard(boardId) || useBoardStore.getState().isDemo) return;
  resyncing = true;
  try {
    const res = await elementApi.fetchElements(boardId);
    if (!res.ok) {
      scheduleResync(boardId, 3_000);
      return;
    }
    if (!isCurrentBoard(boardId)) return;

    // Rebase: server truth first, then every op the server hasn't acked yet.
    const byId = new Map(res.elements.map((el) => [el.id, el] as const));
    const order = res.elements.map((el) => el.id);
    for (const q of [...queue]) {
      if (q.boardId !== boardId) continue;
      const { op } = q;
      if (op.type === 'create') {
        if (!byId.has(op.id)) {
          byId.set(op.id, op.element);
          order.push(op.id);
        }
      } else if (op.type === 'update') {
        const base = byId.get(op.id);
        if (base) byId.set(op.id, { ...base, ...op.patch, version: base.version });
        else queue = queue.filter((x) => x !== q); // deleted remotely
      } else {
        byId.delete(op.id);
      }
    }
    const elements = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
    useBoardStore.getState().replaceElements(elements, { reset: false });
  } finally {
    resyncing = false;
    flush();
  }
}

/* ------------------------------------------------------------------------ */
/* Save status                                                               */
/* ------------------------------------------------------------------------ */

function sameStatus(a: SaveStatus, b: SaveStatus) {
  return a.state === b.state && a.message === b.message;
}

export function updateSaveStatus() {
  const { board, isDemo, saveStatus } = useBoardStore.getState();
  if (!board || isDemo) return;
  const pending = pendingCount(board.id);
  const presence = usePresenceStore.getState();
  let next: SaveStatus;
  if (isLiveFor(board.id)) {
    next = pending ? { state: 'saving' } : { state: 'saved' };
  } else if (presence.status === 'connecting' && !pending) {
    next = { state: 'saving', message: 'connecting…' };
  } else {
    next = {
      state: 'offline',
      message: pending ? `offline · ${pending} change${pending === 1 ? '' : 's'} queued` : 'offline · reconnecting',
    };
  }
  if (!sameStatus(saveStatus, next)) useBoardStore.setState({ saveStatus: next });
}

/* ------------------------------------------------------------------------ */
/* Live transform previews                                                   */
/* ------------------------------------------------------------------------ */

export function onElementPreview(fn: (p: ElementPreview) => void) {
  previewListeners.add(fn);
  return () => {
    previewListeners.delete(fn);
  };
}

export function emitElementPreview(preview: Omit<ElementPreview, 'boardId' | 'by'>) {
  const board = useBoardStore.getState().board;
  const socket = currentSocket();
  if (!board || !socket || !isLiveFor(board.id)) return;
  socket.volatile.emit(REALTIME_EVENTS.elementPreview, { ...preview, boardId: Number(board.id) });
}

/* ------------------------------------------------------------------------ */
/* Inbound events                                                            */
/* ------------------------------------------------------------------------ */

interface ElementPayload {
  boardId: string | number;
  id?: string;
  element?: BoardElement;
}

interface RestoredPayload {
  boardId: string | number;
  elements: BoardElement[];
  restoredBy?: number;
}

interface CommentPayload {
  boardId: string | number;
  comment: BackendComment;
  clientId?: string | null;
}

/**
 * Wires socket.io events to the stores. Re-wires automatically when the
 * presence store swaps sockets, and resyncs after every (re)join.
 */
export function attachRealtimeListeners() {
  let detachSocket = wireSocket(currentSocket());
  const unsubscribe = usePresenceStore.subscribe((state, previous) => {
    if (state.socket !== previous.socket) {
      detachSocket();
      detachSocket = wireSocket(state.socket as SocketLike | null);
    }
    if (state.joinedBoardId && state.joinedBoardId !== previous.joinedBoardId) {
      // Fresh join or rejoin after a drop: anything may have changed while we
      // were away, so reconcile before replaying the outbox.
      for (const q of queue) q.inflight = false;
      scheduleResync(state.joinedBoardId, 0);
    }
    if (!state.joinedBoardId && previous.joinedBoardId) {
      for (const q of queue) q.inflight = false;
    }
    if (state.status !== previous.status || state.joinedBoardId !== previous.joinedBoardId) {
      updateSaveStatus();
    }
  });

  const beforeUnload = (e: BeforeUnloadEvent) => {
    if (queue.length) {
      e.preventDefault();
      e.returnValue = '';
    }
  };
  window.addEventListener('beforeunload', beforeUnload);

  return () => {
    detachSocket();
    unsubscribe();
    window.removeEventListener('beforeunload', beforeUnload);
  };
}

/** Drops queued work for a board the user navigated away from. */
export function resetRealtime(boardId?: string) {
  queue = boardId ? queue.filter((q) => q.boardId !== boardId) : [];
  if (flushTimer) clearTimeout(flushTimer);
  if (retryTimer) clearTimeout(retryTimer);
  if (resyncTimer) clearTimeout(resyncTimer);
  flushTimer = retryTimer = resyncTimer = null;
}

function wireSocket(s: SocketLike | null) {
  if (!s) return () => {};

  const onElement = (...args: unknown[]) => {
    const payload = args[0] as ElementPayload;
    if (!payload?.element || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().applyServerElement(payload.element);
  };
  const onElementRemoved = (...args: unknown[]) => {
    const payload = args[0] as ElementPayload;
    if (!payload?.id || !isCurrentBoard(payload.boardId)) return;
    const id = payload.id;
    // Our own pending edits to a deleted element can never succeed.
    queue = queue.filter((q) => !(q.op.id === id && !q.inflight && q.op.type === 'update'));
    useBoardStore.getState().removeElementLocal(id);
    updateSaveStatus();
  };
  const onRestored = (...args: unknown[]) => {
    const payload = args[0] as RestoredPayload;
    if (!payload || !Array.isArray(payload.elements) || !isCurrentBoard(payload.boardId)) return;
    const boardId = String(payload.boardId);
    // Pending edits were made against the pre-restore board — discard them.
    queue = queue.filter((q) => q.boardId !== boardId);
    useBoardStore.getState().replaceElements(payload.elements, { reset: true });
    void useBoardStore.getState().loadVersions();
    const me = usePresenceStore.getState().selfUserId;
    if (payload.restoredBy !== undefined && String(payload.restoredBy) !== me) {
      toast.info('Board restored to an earlier version', {
        description: 'A collaborator restored a snapshot. Your view has been updated.',
      });
    }
    updateSaveStatus();
  };
  const onBoardUpdated = (...args: unknown[]) => {
    const payload = args[0] as { boardId: number; title?: string; description?: string | null; deleted?: boolean };
    if (!payload || !isCurrentBoard(payload.boardId)) return;
    if (payload.deleted) {
      toast.error('This board was deleted by its owner');
      resetRealtime(String(payload.boardId));
      window.location.assign('/dashboard');
      return;
    }
    useBoardStore.getState().applyBoardMeta({ title: payload.title, description: payload.description ?? undefined });
  };
  const onPreview = (...args: unknown[]) => {
    const payload = args[0] as ElementPreview;
    if (!payload?.id || !isCurrentBoard(payload.boardId)) return;
    previewListeners.forEach((fn) => fn(payload));
  };
  const onCommentCreated = (...args: unknown[]) => {
    const payload = args[0] as CommentPayload;
    if (!payload?.comment || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().upsertComment(mapComment(payload.comment), { clientId: payload.clientId ?? undefined });
  };
  const onCommentUpdated = (...args: unknown[]) => {
    const payload = args[0] as CommentPayload;
    if (!payload?.comment || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().upsertComment(mapComment(payload.comment), { replace: true });
  };
  const onCommentRemoved = (...args: unknown[]) => {
    const payload = args[0] as { boardId: number; id: number | string };
    if (!payload?.id || !isCurrentBoard(payload.boardId)) return;
    useBoardStore.getState().removeComment(String(payload.id), { remote: true });
  };
  const onVersionCreated = (...args: unknown[]) => {
    const payload = args[0] as { boardId: number };
    if (!payload || !isCurrentBoard(payload.boardId)) return;
    void useBoardStore.getState().loadVersions();
  };
  const onServerError = (...args: unknown[]) => {
    const payload = args[0] as { message?: string } | undefined;
    console.warn('[realtime] server error:', payload?.message ?? payload);
  };

  const handlers: Array<[string, (...args: unknown[]) => void]> = [
    [REALTIME_EVENTS.elementCreated, onElement],
    [REALTIME_EVENTS.elementUpdated, onElement],
    [REALTIME_EVENTS.elementRemoved, onElementRemoved],
    [REALTIME_EVENTS.elementPreview, onPreview],
    [REALTIME_EVENTS.restored, onRestored],
    [REALTIME_EVENTS.boardUpdated, onBoardUpdated],
    [REALTIME_EVENTS.commentCreated, onCommentCreated],
    [REALTIME_EVENTS.commentUpdated, onCommentUpdated],
    [REALTIME_EVENTS.commentRemoved, onCommentRemoved],
    [REALTIME_EVENTS.versionCreated, onVersionCreated],
    [REALTIME_EVENTS.error, onServerError],
  ];
  handlers.forEach(([event, fn]) => s.on(event, fn));
  return () => handlers.forEach(([event, fn]) => s.off(event, fn));
}
