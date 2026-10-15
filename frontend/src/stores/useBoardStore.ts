import { create } from 'zustand';
import { toast } from 'sonner';
import type { Board, BoardElement, BoardVersion, CommentItem, SaveStatus } from '../types';
import { demoBoard, demoComments, demoVersions } from '../data/demo';
import * as boardApi from '../api/board.api';
import * as commentApi from '../api/comment.api';
import * as versionApi from '../api/version.api';
import { colorForUser, uid } from '../utils';
import { evaluateSuggestions } from '../services/suggestions';
import { enqueueElementOp, pendingOverlay, resetRealtime, updateSaveStatus, type ElementOp } from '../services/realtime';
import { useAuthStore } from './useAuthStore';

/**
 * One undoable step. Each change records the element before and after a
 * local edit (null = absent), so undo/redo only ever touch what *this* user
 * changed — collaborators' concurrent edits on other elements or fields are
 * left alone, unlike whole-board snapshot undo.
 */
interface ElementChange {
  id: string;
  before: BoardElement | null;
  after: BoardElement | null;
}

interface HistoryEntry {
  changes: ElementChange[];
  at: number;
}

interface BoardState {
  board: Board | null;
  comments: CommentItem[];
  versions: BoardVersion[];
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  /** False for viewers — local mutations are refused before they hit the wire. */
  canEdit: boolean;
  selectedIds: string[];
  clipboard: BoardElement[];
  saveStatus: SaveStatus;
  history: HistoryEntry[];
  future: HistoryEntry[];
  arranged: boolean;
  /** Bumped only when the element set is replaced wholesale (load, restore) — forces a full canvas rebuild. */
  revision: number;

  load: (id: string) => Promise<void>;
  createDemoBoard: () => void;
  setTitle: (title: string) => void;
  applyBoardMeta: (meta: { title?: string; description?: string }) => void;
  setCanEdit: (canEdit: boolean) => void;

  select: (ids: string[]) => void;

  addElement: (element: BoardElement) => void;
  updateElement: (id: string, patch: Partial<BoardElement>) => void;
  removeElements: (ids: string[]) => void;
  clearSelection: () => void;

  /** Authoritative row from the server (ack or broadcast), applied by version. */
  applyServerElement: (element: BoardElement, opts?: { fromAck?: boolean }) => void;
  /** Removes an element that no longer exists server-side (no history, no echo). */
  removeElementLocal: (id: string) => void;
  /** Replaces the whole element set (restore / resync). */
  replaceElements: (elements: BoardElement[], opts: { reset: boolean }) => void;

  copyElements: (ids: string[]) => void;
  /** Moves elements above (front) or below (back) everything else. */
  reorder: (ids: string[], direction: 'front' | 'back') => void;
  setLocked: (ids: string[], locked: boolean) => void;
  /**
   * Persists state derived from other elements (e.g. connector routes that
   * follow a moved shape). Synced like any edit but never an undo step —
   * undoing the shape move re-derives it.
   */
  applyDerivedUpdate: (id: string, patch: Partial<BoardElement>) => void;
  pasteElements: () => void;
  duplicateElements: (ids: string[]) => void;

  addComment: (text: string, opts?: { elementId?: string; x?: number; y?: number }) => void;
  upsertComment: (comment: CommentItem, opts?: { clientId?: string; replace?: boolean }) => void;
  removeComment: (id: string, opts?: { remote?: boolean }) => void;

  loadVersions: () => Promise<void>;
  createVersion: (label?: string) => Promise<boolean>;
  restoreVersion: (id: string) => Promise<{ ok: boolean; message?: string }>;

  /** Seals the current undo step so the next edit starts a new one. */
  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  suggestions: () => ReturnType<typeof evaluateSuggestions>;
}

const MAX_HISTORY = 100;
/** Consecutive text edits to one element within this window form one undo step. */
const TYPING_COALESCE_MS = 1_000;
const TYPING_KEYS = new Set(['content', 'width', 'height']);

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Keys whose values differ between two element states. */
function changedKeys(a: BoardElement, b: BoardElement): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  keys.delete('version');
  keys.delete('id');
  return [...keys].filter((k) => !same(a[k as keyof BoardElement], b[k as keyof BoardElement]));
}

/** Patch that moves `from` to `to` on the given keys (null clears optional fields). */
function patchTowards(to: BoardElement, keys: string[]): Partial<BoardElement> {
  const patch: Record<string, unknown> = {};
  for (const k of keys) {
    const v = to[k as keyof BoardElement];
    if (v !== undefined) patch[k] = v;
    else if (k === 'attachment') patch[k] = null;
  }
  return patch as Partial<BoardElement>;
}

function currentUserRole(board: Board): Board['members'][number]['role'] | null {
  const me = useAuthStore.getState().user?.id;
  return board.members.find((m) => m.id === me)?.role ?? null;
}

export const useBoardStore = create<BoardState>((set, get) => {
  /** True within the macrotask that opened the latest history entry. */
  let entryOpen = false;
  /** Set by commitHistory so the next change never coalesces into the last step. */
  let sealed = true;
  /** Undo/redo replay must not record new history. */
  let replaying = false;

  const record = (change: ElementChange) => {
    if (replaying) return;
    const { history } = get();
    const last = history[history.length - 1];
    const now = Date.now();

    const merge = (entry: HistoryEntry): HistoryEntry => {
      const existing = entry.changes.find((c) => c.id === change.id);
      const changes = existing
        ? entry.changes.map((c) => (c.id === change.id ? { ...c, after: change.after } : c))
        : [...entry.changes, change];
      return { changes, at: now };
    };

    const isTyping =
      !!last &&
      !sealed &&
      last.changes.length === 1 &&
      last.changes[0]!.id === change.id &&
      !!change.before &&
      !!change.after &&
      !!last.changes[0]!.after &&
      now - last.at < TYPING_COALESCE_MS &&
      changedKeys(change.before, change.after).every((k) => TYPING_KEYS.has(k));

    let nextHistory: HistoryEntry[];
    if (last && (entryOpen || isTyping)) {
      nextHistory = [...history.slice(0, -1), merge(last)];
    } else {
      nextHistory = [...history, { changes: [change], at: now }].slice(-MAX_HISTORY);
    }
    set({ history: nextHistory, future: [] });

    sealed = false;
    if (!entryOpen) {
      entryOpen = true;
      // Everything changed in this tick (multi-select drag, paste) is one step.
      setTimeout(() => {
        entryOpen = false;
      }, 0);
    }
  };

  const persist = (op: ElementOp) => {
    const { board, isDemo } = get();
    if (!board || isDemo) return; // preview boards are never persisted
    enqueueElementOp(board.id, op);
  };

  const guardEdit = (): Board | null => {
    const { board, canEdit, isDemo } = get();
    if (!board) return null;
    if (!canEdit && !isDemo) {
      toast.info('This board is view-only for you', { id: 'vb-readonly' });
      return null;
    }
    return board;
  };

  /* -- primitive local mutations (optimistic + queued + recorded) -------- */

  const createLocal = (element: BoardElement) => {
    const board = get().board;
    if (!board) return;
    if (board.elements.some((el) => el.id === element.id)) return;
    const el = { ...element, version: element.version ?? 0 };
    set({
      board: { ...board, elements: [...board.elements, el], updatedAt: new Date().toISOString() },
      arranged: false,
    });
    record({ id: el.id, before: null, after: el });
    persist({ type: 'create', id: el.id, element: el });
  };

  const updateLocal = (id: string, patch: Partial<BoardElement>) => {
    const board = get().board;
    if (!board) return;
    const prev = board.elements.find((el) => el.id === id);
    if (!prev) return;
    const next = { ...prev, ...patch, id, version: prev.version } as BoardElement;
    const keys = changedKeys(prev, next);
    if (!keys.length) return;
    set({
      board: {
        ...board,
        elements: board.elements.map((el) => (el.id === id ? next : el)),
        updatedAt: new Date().toISOString(),
      },
      arranged: false,
    });
    record({ id, before: prev, after: next });
    persist({ type: 'update', id, patch: patchTowards(next, keys) });
  };

  const deleteLocal = (ids: string[]) => {
    const board = get().board;
    if (!board) return;
    const idSet = new Set(ids);
    const removed = board.elements.filter((el) => idSet.has(el.id));
    if (!removed.length) return;
    set({
      board: {
        ...board,
        elements: board.elements.filter((el) => !idSet.has(el.id)),
        updatedAt: new Date().toISOString(),
      },
      selectedIds: get().selectedIds.filter((id) => !idSet.has(id)),
    });
    removed.forEach((el) => {
      record({ id: el.id, before: el, after: null });
      persist({ type: 'delete', id: el.id });
    });
  };

  /** Applies one side of a history entry. `toward` picks before (undo) or after (redo). */
  const replay = (entry: HistoryEntry, toward: 'before' | 'after') => {
    replaying = true;
    try {
      const changes = toward === 'before' ? [...entry.changes].reverse() : entry.changes;
      for (const change of changes) {
        const target = change[toward];
        const other = change[toward === 'before' ? 'after' : 'before'];
        const current = get().board?.elements.find((el) => el.id === change.id) ?? null;
        if (target === null) {
          if (current) deleteLocal([change.id]);
        } else if (other === null) {
          // Re-create something this step deleted (or redo a creation).
          if (!current) createLocal(target);
        } else if (current) {
          // Field-level revert: only the fields this step changed. An element a
          // collaborator deleted meanwhile is not resurrected by an update undo.
          const keys = changedKeys(change.before!, change.after!);
          updateLocal(change.id, patchTowards(target, keys));
        }
      }
    } finally {
      replaying = false;
    }
  };

  const resetHistory = () => {
    entryOpen = false;
    sealed = true;
    return { history: [] as HistoryEntry[], future: [] as HistoryEntry[] };
  };

  return {
    board: null,
    comments: [],
    versions: [],
    loading: false,
    error: null,
    isDemo: false,
    canEdit: true,
    selectedIds: [],
    clipboard: [],
    saveStatus: { state: 'idle' },
    history: [],
    future: [],
    arranged: false,
    revision: 0,

    load: async (id) => {
      const previous = get().board?.id;
      if (previous && previous !== id) resetRealtime(previous);
      set({ loading: true, error: null });
      const [boardRes, comments] = await Promise.all([boardApi.fetchBoard(id), commentApi.fetchComments(id)]);
      if (boardRes.ok && boardRes.board) {
        const role = currentUserRole(boardRes.board);
        set({
          board: boardRes.board,
          comments,
          isDemo: false,
          canEdit: role ? role !== 'viewer' : true,
          loading: false,
          selectedIds: [],
          saveStatus: { state: 'saved' },
          revision: Date.now(),
          ...resetHistory(),
        });
        updateSaveStatus();
        void get().loadVersions();
        return;
      }
      set({
        board: { ...demoBoard, id },
        comments: demoComments,
        isDemo: true,
        canEdit: true,
        loading: false,
        selectedIds: [],
        error: boardRes.message ?? null,
        saveStatus: { state: 'offline', message: 'Preview board — demo data' },
        revision: Date.now(),
        ...resetHistory(),
      });
    },

    createDemoBoard: () => {
      set({
        board: { ...demoBoard, id: uid('board') },
        comments: demoComments,
        isDemo: true,
        canEdit: true,
        loading: false,
        error: null,
        selectedIds: [],
        saveStatus: { state: 'offline', message: 'Preview board — demo data' },
        revision: Date.now(),
        ...resetHistory(),
      });
    },

    setTitle: (title) => {
      const board = guardEdit();
      if (!board || title === board.title) return;
      const previous = board.title;
      set({ board: { ...board, title } });
      if (get().isDemo) return;
      void boardApi.updateBoard(board.id, { title }).then((res) => {
        if (res.ok) return;
        const current = get().board;
        if (current?.id === board.id && current.title === title) set({ board: { ...current, title: previous } });
        toast.error('Could not rename the board', { description: res.message });
      });
    },

    applyBoardMeta: ({ title, description }) => {
      const board = get().board;
      if (!board) return;
      set({
        board: {
          ...board,
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      });
    },

    setCanEdit: (canEdit) => set({ canEdit }),

    select: (selectedIds) => set({ selectedIds }),

    addElement: (element) => {
      if (!guardEdit()) return;
      createLocal(element);
    },

    updateElement: (id, patch) => {
      if (!guardEdit()) return;
      updateLocal(id, patch);
    },

    removeElements: (ids) => {
      if (!guardEdit()) return;
      deleteLocal(ids);
    },

    clearSelection: () => set({ selectedIds: [] }),

    applyServerElement: (incoming, opts) => {
      const board = get().board;
      if (!board || !incoming?.id) return;
      const overlay = pendingOverlay(incoming.id);
      if (overlay.deleted) return; // our delete is on its way
      const local = board.elements.find((el) => el.id === incoming.id);
      const incomingVersion = typeof incoming.version === 'number' ? incoming.version : 0;
      // Stale broadcast (delivered after a newer state we already applied).
      if (local && (local.version ?? 0) > incomingVersion) return;

      // Rebase not-yet-acknowledged local edits on top of the server row.
      const next = { ...incoming, ...(overlay.patch ?? {}), id: incoming.id, version: incomingVersion } as BoardElement;
      if (local && !changedKeys(local, next).length && local.version === next.version) return;

      set({
        board: {
          ...board,
          elements: local
            ? board.elements.map((el) => (el.id === incoming.id ? next : el))
            : [...board.elements, next],
        },
        arranged: opts?.fromAck ? get().arranged : false,
      });
    },

    removeElementLocal: (id) => {
      const board = get().board;
      if (!board || !board.elements.some((el) => el.id === id)) return;
      set({
        board: { ...board, elements: board.elements.filter((el) => el.id !== id) },
        selectedIds: get().selectedIds.filter((x) => x !== id),
      });
    },

    replaceElements: (elements, { reset }) => {
      const board = get().board;
      if (!board) return;
      const ids = new Set(elements.map((el) => el.id));
      set({
        board: { ...board, elements, updatedAt: new Date().toISOString() },
        selectedIds: get().selectedIds.filter((id) => ids.has(id)),
        arranged: false,
        ...(reset ? { revision: Date.now(), ...resetHistory() } : {}),
      });
    },

    reorder: (ids, direction) => {
      const board = guardEdit();
      if (!board || !ids.length) return;
      const others = board.elements.filter((el) => !ids.includes(el.id)).map((el) => el.zIndex ?? 0);
      const base = others.length ? (direction === 'front' ? Math.max(...others) + 1 : Math.min(...others) - 1) : 0;
      // Keep the moved elements' relative order.
      const moving = board.elements.filter((el) => ids.includes(el.id));
      moving.forEach((el, i) => updateLocal(el.id, { zIndex: direction === 'front' ? base + i : base - (moving.length - 1 - i) }));
    },

    applyDerivedUpdate: (id, patch) => {
      const { canEdit, isDemo } = get();
      if (!canEdit && !isDemo) return;
      const wasReplaying = replaying;
      replaying = true;
      try {
        updateLocal(id, patch);
      } finally {
        replaying = wasReplaying;
      }
    },

    setLocked: (ids, locked) => {
      if (!guardEdit()) return;
      ids.forEach((id) => updateLocal(id, { locked }));
    },

    copyElements: (ids) => {
      const { board } = get();
      if (!board) return;
      set({ clipboard: board.elements.filter((el) => ids.includes(el.id)) });
    },

    pasteElements: () => {
      const { clipboard } = get();
      if (!clipboard.length || !guardEdit()) return;
      const fresh = clipboard.map((el) => ({ ...el, id: uid('el'), x: el.x + 20, y: el.y + 20, version: 0 }));
      fresh.forEach(createLocal);
      // Offset the clipboard so repeated pastes cascade instead of stacking.
      set({ clipboard: fresh, selectedIds: fresh.map((el) => el.id) });
    },

    duplicateElements: (ids) => {
      const board = guardEdit();
      if (!board) return;
      const fresh = board.elements
        .filter((el) => ids.includes(el.id))
        .map((el) => ({ ...el, id: uid('el'), x: el.x + 20, y: el.y + 20, version: 0 }));
      fresh.forEach(createLocal);
      set({ selectedIds: fresh.map((el) => el.id) });
    },

    addComment: (text, opts) => {
      const { board, isDemo } = get();
      const content = text.trim();
      if (!board || !content) return;
      const authUser = useAuthStore.getState().user;
      const authorId = authUser?.id ?? 'u_local';
      const clientId = uid('c_temp');

      // Element pins also remember an absolute anchor so the thread stays put
      // on the canvas if the element is deleted later.
      const el = opts?.elementId ? board.elements.find((e) => e.id === opts.elementId) : undefined;
      const x = opts?.x ?? el?.x;
      const y = opts?.y ?? el?.y;

      const comment: CommentItem = {
        id: clientId,
        boardId: board.id,
        elementId: opts?.elementId,
        x,
        y,
        author: { id: authorId, name: authUser?.name ?? 'You', color: colorForUser(authorId) },
        text: content,
        createdAt: new Date().toISOString(),
        pending: !isDemo,
      };
      set({ comments: [...get().comments, comment] });
      if (isDemo) return;

      // Single write path: REST. The server broadcasts the saved comment (with
      // our clientId) to the room — emitting over the socket as well used to
      // persist every comment twice.
      void commentApi
        .createComment(board.id, { text: content, elementId: opts?.elementId, x, y, clientId })
        .then((saved) => {
          if (get().board?.id !== board.id) return;
          if (saved) {
            get().upsertComment(saved, { clientId });
            return;
          }
          set({ comments: get().comments.map((c) => (c.id === clientId ? { ...c, pending: false, failed: true } : c)) });
          toast.error('Comment could not be posted', { description: 'It is kept locally — try again.' });
        });
    },

    upsertComment: (comment, opts) => {
      set((s) => {
        const hasServerCopy = s.comments.some((c) => c.id === comment.id);
        // Server copy of our optimistic comment (from the REST response or the
        // room broadcast, whichever lands first).
        if (opts?.clientId && s.comments.some((c) => c.id === opts.clientId)) {
          const swapped = s.comments.map((c) => (c.id === opts.clientId ? comment : c));
          return { comments: hasServerCopy ? dedupeById(swapped) : swapped };
        }
        if (hasServerCopy) {
          return opts?.replace ? { comments: s.comments.map((c) => (c.id === comment.id ? comment : c)) } : s;
        }
        return { comments: [...s.comments, comment] };
      });
    },

    removeComment: (id, opts) => {
      const { board, comments, isDemo } = get();
      if (!board) return;
      const removed = comments.find((c) => c.id === id);
      if (!removed) return;
      set({ comments: comments.filter((c) => c.id !== id) });
      if (opts?.remote || isDemo || id.startsWith('c_temp')) return;

      void commentApi.deleteComment(board.id, id).then((res) => {
        if (res.ok || get().board?.id !== board.id) return;
        // Put it back where it was.
        set({ comments: dedupeById([...get().comments, removed]).sort(byCreatedAt) });
        toast.error('Comment could not be deleted', { description: res.message });
      });
    },

    loadVersions: async () => {
      const { board, isDemo } = get();
      if (!board || isDemo) {
        set({ versions: demoVersions });
        return;
      }
      const versions = await versionApi.fetchVersions(board.id);
      if (get().board?.id === board.id) set({ versions });
    },

    createVersion: async (label) => {
      const { board, isDemo } = get();
      if (!board || isDemo) return false;
      const created = await versionApi.createVersion(board.id, label);
      if (!created) return false;
      if (get().board?.id === board.id) {
        set({ versions: [created, ...get().versions.filter((v) => v.id !== created.id)] });
      }
      return true;
    },

    restoreVersion: async (id) => {
      const { board, isDemo } = get();
      if (!board || isDemo) return { ok: false, message: 'Preview boards have no saved versions' };
      const res = await versionApi.restoreVersion(board.id, id);
      if (!res.ok) return { ok: false, message: res.message };
      // The room broadcast carries the same state; applying the response too
      // makes the initiator independent of socket health.
      if (get().board?.id === board.id) {
        resetRealtime(board.id);
        get().replaceElements(res.elements, { reset: true });
        void get().loadVersions();
      }
      return { ok: true };
    },

    commitHistory: () => {
      entryOpen = false;
      sealed = true;
    },

    undo: () => {
      const { history, future } = get();
      const entry = history[history.length - 1];
      if (!entry || !guardEdit()) return;
      set({ history: history.slice(0, -1), future: [entry, ...future] });
      replay(entry, 'before');
      sealed = true;
    },

    redo: () => {
      const { history, future } = get();
      const entry = future[0];
      if (!entry || !guardEdit()) return;
      set({ history: [...history, entry].slice(-MAX_HISTORY), future: future.slice(1) });
      replay(entry, 'after');
      sealed = true;
    },

    suggestions: () => {
      const { board } = get();
      return board ? evaluateSuggestions(board.elements) : [];
    },
  };
});

function dedupeById(comments: CommentItem[]): CommentItem[] {
  const seen = new Set<string>();
  return comments.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

function byCreatedAt(a: CommentItem, b: CommentItem) {
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

/** Live versions for the current board (falls back to demo data offline). */
export const useVersions = () => useBoardStore((s) => s.versions);
