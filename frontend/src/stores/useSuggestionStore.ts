import { create } from 'zustand';
import { ActiveSelection } from 'fabric';
import type { Suggestion } from '../types';
import { planSuggestion } from '../services/suggestionActions';
import { elementBox, unionBox } from '../services/geometry';
import { useBoardStore } from './useBoardStore';
import { useCanvasStore } from './useCanvasStore';
import { elementId } from '../services/fabric.elements';

/**
 * Makes `ids` the canvas selection (selection normally flows canvas → store).
 * Freshly added elements get their Fabric objects on the next reconcile, so
 * retry for a few frames.
 */
function selectOnCanvas(ids: string[], tries = 12) {
  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) return;
  const want = new Set(ids);
  const objs = canvas.getObjects().filter((o) => want.has(elementId(o) ?? ''));
  if (objs.length < ids.length && tries > 0) {
    requestAnimationFrame(() => selectOnCanvas(ids, tries - 1));
    return;
  }
  if (!objs.length) return;
  canvas.discardActiveObject();
  canvas.setActiveObject(objs.length > 1 ? new ActiveSelection(objs, { canvas }) : objs[0]!);
  canvas.requestRenderAll();
}

const KEY = (boardId: string) => `vb_suggestions_dismissed:${boardId}`;

function readDismissed(boardId: string): Set<string> {
  try {
    const raw = localStorage.getItem(KEY(boardId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeDismissed(boardId: string, ids: Set<string>) {
  try {
    localStorage.setItem(KEY(boardId), JSON.stringify([...ids].slice(-200)));
  } catch {
    /* storage unavailable — dismissals last for the session */
  }
}

interface SuggestionState {
  boardId: string | null;
  /** Suggestion ids hidden on this board (persisted per board, per browser). */
  dismissed: Set<string>;

  /** Loads the dismissals for a board. */
  setBoard: (boardId: string) => void;
  dismiss: (id: string) => void;
  restoreAll: () => void;
  /** Applies a suggestion's action as one undo step. Returns false if nothing could be done. */
  apply: (s: Suggestion) => boolean;
  /** Selects and frames elements on the canvas. */
  focus: (ids: string[]) => void;
}

export const useSuggestionStore = create<SuggestionState>((set, get) => ({
  boardId: null,
  dismissed: new Set(),

  setBoard: (boardId) => {
    if (get().boardId === boardId) return;
    set({ boardId, dismissed: readDismissed(boardId) });
  },

  dismiss: (id) => {
    const { boardId } = get();
    const dismissed = new Set(get().dismissed).add(id);
    set({ dismissed });
    if (boardId) writeDismissed(boardId, dismissed);
  },

  restoreAll: () => {
    const { boardId } = get();
    set({ dismissed: new Set() });
    if (boardId) writeDismissed(boardId, new Set());
  },

  apply: (s) => {
    const store = useBoardStore.getState();
    const elements = store.board?.elements ?? [];
    const plan = planSuggestion(s, elements);
    if (!plan) return false;
    if (plan.add.length || plan.remove.length) {
      if (!store.canEdit && !store.isDemo) return false;
      // Everything below runs in one macrotask → one undo step.
      store.commitHistory();
      for (const el of plan.add) store.addElement(el);
      if (plan.remove.length) store.removeElements(plan.remove);
      store.commitHistory();
    }
    get().focus(plan.focus);
    return true;
  },

  focus: (ids) => {
    const board = useBoardStore.getState().board;
    const els = (board?.elements ?? []).filter((e) => ids.includes(e.id));
    if (!els.length) return;
    useBoardStore.getState().select(els.map((e) => e.id));
    selectOnCanvas(els.map((e) => e.id));
    const box = unionBox(els.map(elementBox));
    if (box) useCanvasStore.getState().fitBox(box, { animate: true, maxScale: 1.1 });
  },
}));
