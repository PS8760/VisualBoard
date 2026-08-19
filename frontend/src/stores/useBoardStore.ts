import { create } from 'zustand';
import type { Board, BoardElement, BoardVersion, CommentItem, SaveStatus } from '../types';
import { demoBoard, demoComments, demoVersions } from '../data/demo';
import * as boardApi from '../api/board.api';
import * as elementApi from '../api/element.api';
import * as commentApi from '../api/comment.api';
import * as versionApi from '../api/version.api';
import { debounce, uid } from '../utils';
import { computeArrange, type ArrangeTarget } from '../services/arrange';
import { evaluateSuggestions } from '../services/suggestions';
import { emitElementEvent } from '../services/realtime';
import { usePresenceStore } from './usePresenceStore';

interface HistoryEntry {
  elements: BoardElement[];
}

interface BoardState {
  board: Board | null;
  comments: CommentItem[];
  versions: BoardVersion[];
  loading: boolean;
  error: string | null;
  isDemo: boolean;
  selectedIds: string[];
  clipboard: BoardElement[];
  saveStatus: SaveStatus;
  history: HistoryEntry[];
  future: HistoryEntry[];
  arranged: boolean;
  revision: number;

  load: (id: string) => Promise<void>;
  createDemoBoard: () => void;
  setTitle: (title: string) => void;

  select: (ids: string[]) => void;

  addElement: (element: BoardElement, opts?: { remote?: boolean }) => void;
  updateElement: (id: string, patch: Partial<BoardElement>, opts?: { remote?: boolean }) => void;
  removeElements: (ids: string[], opts?: { remote?: boolean }) => void;
  clearSelection: () => void;

  copyElements: (ids: string[]) => void;
  pasteElements: () => void;
  duplicateElements: (ids: string[]) => void;

  addComment: (text: string, opts?: { elementId?: string; x?: number; y?: number }) => void;
  upsertComment: (comment: CommentItem, opts?: { clientId?: string }) => void;
  removeComment: (id: string, opts?: { remote?: boolean }) => void;

  loadVersions: () => Promise<void>;
  createVersion: () => Promise<boolean>;
  restoreVersion: (id: string) => Promise<boolean>;

  commitHistory: () => void;
  undo: () => void;
  redo: () => void;

  arrange: () => ArrangeTarget[];
  suggestions: () => ReturnType<typeof evaluateSuggestions>;

  save: (force?: boolean) => void;
}

const MAX_HISTORY = 60;

export const useBoardStore = create<BoardState>((set, get) => {
  const snapshot = (elements: BoardElement[]): HistoryEntry => ({ elements });

  const pushHistory = () => {
    const { board, history } = get();
    if (!board) return;
    set({
      history: [...history, snapshot(board.elements)].slice(-MAX_HISTORY),
      future: [],
    });
  };

  const saveDebounced = debounce(() => {
    const { board } = get();
    if (!board) return;
    set({ saveStatus: { state: 'saving' } });
    elementApi.saveElements(board.id, board.elements).then((res) => {
      set({
        saveStatus: res.ok
          ? { state: 'saved' }
          : { state: 'error', message: res.message ?? 'Save failed — retrying on next change' },
      });
    });
  }, 900);

  const persistElementChange = (sentLive: boolean) => {
    if (get().isDemo) return;
    if (sentLive) {
      set({ saveStatus: { state: 'saving' } });
      return;
    }
    get().save();
  };

  const markRealtimeSaved = () => {
    if (!get().isDemo) set({ saveStatus: { state: 'saved' } });
  };

  const emitSnapshotDiff = (boardId: string, before: BoardElement[], after: BoardElement[]): boolean => {
    const beforeById = new Map(before.map((el) => [el.id, el]));
    const afterById = new Map(after.map((el) => [el.id, el]));
    let sentLive = false;

    before.forEach((el) => {
      if (!afterById.has(el.id)) {
        sentLive = emitElementEvent('element:removed', { boardId, id: el.id }) || sentLive;
      }
    });

    after.forEach((el) => {
      const prev = beforeById.get(el.id);
      if (!prev) {
        sentLive = emitElementEvent('element:created', { boardId, element: el }) || sentLive;
        return;
      }
      if (JSON.stringify(prev) !== JSON.stringify(el)) {
        sentLive = emitElementEvent('element:updated', { boardId, id: el.id, patch: el }) || sentLive;
      }
    });

    return sentLive;
  };

  return {
    board: null,
    comments: [],
    versions: [],
    loading: false,
    error: null,
    isDemo: false,
    selectedIds: [],
    clipboard: [],
    saveStatus: { state: 'idle' },
    history: [],
    future: [],
    arranged: false,
    revision: 0,

    load: async (id) => {
      set({ loading: true, error: null });
      const [boardRes, comments] = await Promise.all([
        boardApi.fetchBoard(id),
        commentApi.fetchComments(id),
      ]);
      if (boardRes.ok && boardRes.board) {
        set({
          board: boardRes.board,
          comments,
          isDemo: false,
          loading: false,
          saveStatus: { state: 'saved' },
          revision: Date.now(),
        });
        void get().loadVersions();
        return;
      }
      const demo = { ...demoBoard, id };
      set({
        board: demo,
        comments: demoComments,
        isDemo: true,
        loading: false,
        error: boardRes.message ?? null,
        saveStatus: { state: 'offline', message: 'Preview board — demo data' },
        revision: Date.now(),
      });
    },

    createDemoBoard: () => {
      set({
        board: { ...demoBoard, id: uid('board') },
        comments: demoComments,
        isDemo: true,
        loading: false,
        error: null,
        saveStatus: { state: 'offline', message: 'Preview board — demo data' },
        revision: Date.now(),
      });
    },

    setTitle: (title) => {
      const { board } = get();
      if (!board) return;
      set({ board: { ...board, title } });
      get().save(true);
    },

    select: (selectedIds) => set({ selectedIds }),

    addElement: (element, opts) => {
      const { board } = get();
      if (!board) return;
      const exists = board.elements.some((el) => el.id === element.id);
      if (opts?.remote) {
        if (exists) {
          get().updateElement(element.id, element, { remote: true });
          return;
        }
      } else {
        pushHistory();
      }
      set({
        board: { ...board, elements: [...board.elements, element], updatedAt: new Date().toISOString() },
        arranged: false,
        revision: opts?.remote ? Date.now() : get().revision,
      });
      get().save();
      if (!opts?.remote) {
        emitElementEvent('element:created', { boardId: board.id, element });
      }
    },

    updateElement: (id, patch, opts) => {
      const { board } = get();
      if (!board) return;
      const prev = board.elements.find((el) => el.id === id);
      if (!prev && opts?.remote) return;
      set({
        board: {
          ...board,
          elements: board.elements.map((el) =>
            el.id === id ? { ...el, ...patch, version: (prev?.version ?? 0) + 1 } : el,
          ),
          updatedAt: new Date().toISOString(),
        },
        arranged: false,
        revision: opts?.remote ? Date.now() : get().revision,
      });
      get().save();
      if (!opts?.remote) {
        emitElementEvent('element:updated', { boardId: board.id, id, patch });
      }
    },

    removeElements: (ids, opts) => {
      const { board, selectedIds } = get();
      if (!board) return;
      const idSet = new Set(ids);
      if (!opts?.remote) pushHistory();
      set({
        board: {
          ...board,
          elements: board.elements.filter((el) => !idSet.has(el.id)),
          updatedAt: new Date().toISOString(),
        },
        selectedIds: selectedIds.filter((id) => !idSet.has(id)),
        revision: Date.now(),
      });
      get().save();
      if (!opts?.remote) {
        ids.forEach((id) => emitElementEvent('element:removed', { boardId: board.id, id }));
      }
    },

    clearSelection: () => set({ selectedIds: [] }),

    copyElements: (ids) => {
      const { board } = get();
      if (!board) return;
      const elements = board.elements.filter((el) => ids.includes(el.id));
      set({ clipboard: elements });
    },

    pasteElements: () => {
      const { board, clipboard } = get();
      if (!board || !clipboard.length) return;

      pushHistory();
      const newElements: BoardElement[] = clipboard.map((el) => ({
        ...el,
        id: uid('el'),
        x: el.x + 20,
        y: el.y + 20,
        version: 1,
      }));

      set({
        board: {
          ...board,
          elements: [...board.elements, ...newElements],
          updatedAt: new Date().toISOString(),
        },
        selectedIds: newElements.map((el) => el.id),
        revision: Date.now(),
      });

      newElements.forEach((el) => {
        emitElementEvent('element:created', { boardId: board.id, element: el });
      });

      get().save();
    },

    duplicateElements: (ids) => {
      const { board } = get();
      if (!board) return;

      pushHistory();
      const elements = board.elements.filter((el) => ids.includes(el.id));
      const newElements: BoardElement[] = elements.map((el) => ({
        ...el,
        id: uid('el'),
        x: el.x + 20,
        y: el.y + 20,
        version: 1,
      }));

      set({
        board: {
          ...board,
          elements: [...board.elements, ...newElements],
          updatedAt: new Date().toISOString(),
        },
        selectedIds: newElements.map((el) => el.id),
        revision: Date.now(),
      });

      newElements.forEach((el) => {
        emitElementEvent('element:created', { boardId: board.id, element: el });
      });

      get().save();
    },

    addComment: (text, opts) => {
      const { board } = get();
      if (!board) return;
      const author = { id: 'u_local', name: 'You', color: '#d9480f' };
      const clientId = uid('c_temp');
      const comment: CommentItem = {
        id: clientId,
        boardId: board.id,
        elementId: opts?.elementId,
        x: opts?.x,
        y: opts?.y,
        author,
        text,
        createdAt: new Date().toISOString(),
      };
      set({ comments: [...get().comments, comment] });

      if (opts?.elementId) {
        const el = board.elements.find((e) => e.id === opts.elementId);
        get().updateElement(opts.elementId, {
          commentCount: (el?.commentCount ?? 0) + 1,
        });
      }

      // Emit real-time event to other collaborators
      const { socket, mode } = usePresenceStore.getState();
      if (mode === 'live' && socket) {
        (socket as any).emit('comment:created', {
          boardId: board.id,
          content: text,
          element_id: opts?.elementId,
          x: opts?.x,
          y: opts?.y,
          clientId,
        });
      }

      commentApi.createComment(board.id, { text, elementId: opts?.elementId, x: opts?.x, y: opts?.y }).then((saved) => {
        if (saved && !get().isDemo) {
          // Replace the optimistic temp entry with the saved one
          set({
            comments: get().comments.map((c) => (c.id === clientId ? saved : c)),
          });
          // Do NOT emit a second socket event here — the raw socket emit above
          // already notified collaborators. A second emit causes the server to
          // broadcast again and produces duplicate comments for everyone.
        }
      });
    },

    upsertComment: (comment, opts) => {
      set((s) => {
        // If we have a clientId, this is the server echo of our own optimistic comment.
        // Replace the temp entry instead of appending a duplicate.
        if (opts?.clientId) {
          const hasTemp = s.comments.some((c) => c.id === opts.clientId);
          if (hasTemp) {
            return { comments: s.comments.map((c) => (c.id === opts.clientId ? comment : c)) };
          }
        }
        // Deduplicate by real server id — if we already reconciled this comment, skip it.
        if (s.comments.some((c) => c.id === comment.id)) return s;
        // Genuinely new comment from a collaborator — append it.
        return { comments: [...s.comments, comment] };
      });
    },

    removeComment: (id, opts) => {
      const { board } = get();
      if (!board) return;
      set({ comments: get().comments.filter((c) => c.id !== id) });

      // Emit real-time event if not from remote
      if (!opts?.remote) {
        const { socket, mode } = usePresenceStore.getState();
        if (mode === 'live' && socket) {
          (socket as any).emit('comment:removed', {
            boardId: board.id,
            id,
          });
        }
      }

      void commentApi.deleteComment(board.id, id);
    },

    loadVersions: async () => {
      const { board } = get();
      if (!board || board.id.startsWith('demo')) {
        set({ versions: demoVersions });
        return;
      }
      const versions = await versionApi.fetchVersions(board.id);
      set({ versions: versions.length ? versions : demoVersions });
    },

    createVersion: async () => {
      const { board } = get();
      if (!board) return false;
      const created = await versionApi.createVersion(board.id);
      if (created) {
        set({ versions: [created, ...get().versions] });
        return true;
      }
      return false;
    },

    restoreVersion: async (id) => {
      const { board } = get();
      if (!board) return false;
      const res = await versionApi.restoreVersion(board.id, id);
      if (res.ok) {
        await get().load(board.id);
        void get().loadVersions();
      }
      return res.ok;
    },

    commitHistory: () => {
      const { history, board } = get();
      if (!board) return;
      set({ history: [...history, snapshot(board.elements)].slice(-MAX_HISTORY), future: [] });
    },

    undo: () => {
      const { history, future, board } = get();
      if (!history.length || !board) return;
      const prev = history[history.length - 1];
      set({
        history: history.slice(0, -1),
        future: [snapshot(board.elements), ...future],
        board: { ...board, elements: prev.elements, updatedAt: new Date().toISOString() },
        arranged: false,
        revision: Date.now(),
      });
      get().save();
    },

    redo: () => {
      const { history, future, board } = get();
      if (!future.length || !board) return;
      const next = future[0];
      set({
        history: [...history, snapshot(board.elements)],
        future: future.slice(1),
        board: { ...board, elements: next.elements, updatedAt: new Date().toISOString() },
        arranged: false,
        revision: Date.now(),
      });
      get().save();
    },

    arrange: () => {
      const { board } = get();
      if (!board) return [];
      return computeArrange(board.elements);
    },

    suggestions: () => {
      const { board } = get();
      if (!board) return [];
      return evaluateSuggestions(board.elements);
    },

    save: (force = false) => {
      void force;
      saveDebounced();
    },
  };
});

/** Live versions for the current board (falls back to demo data offline). */
export const useVersions = () => useBoardStore((s) => s.versions);
