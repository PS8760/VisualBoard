import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Board, BoardElement } from '../src/types';

vi.mock('../src/services/realtime', () => ({
  enqueueElementOp: vi.fn(),
  pendingOverlay: () => ({ deleted: false, patch: null }),
  resetRealtime: vi.fn(),
  updateSaveStatus: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn() }) }));

import { enqueueElementOp } from '../src/services/realtime';
import { useBoardStore } from '../src/stores/useBoardStore';
import { buildThreads } from '../src/services/commentThreads';

const rect = (id: string, extra: Partial<BoardElement> = {}): BoardElement => ({
  id,
  kind: 'rect',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  rotation: 0,
  fill: '#fff',
  stroke: '#000',
  strokeWidth: 1,
  content: '',
  version: 1,
  ...extra,
});

const board = (elements: BoardElement[]): Board => ({
  id: '1',
  title: 'B',
  ownerId: '1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  elements,
  members: [],
});

const el = (id: string) => useBoardStore.getState().board!.elements.find((e) => e.id === id);

describe('collaborative undo/redo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useBoardStore.setState({ board: board([rect('a'), rect('b')]), isDemo: false, canEdit: true, history: [], future: [] });
    useBoardStore.getState().commitHistory();
  });
  afterEach(() => vi.useRealTimers());

  it('reverts only the fields this user changed, keeping collaborators’ edits', () => {
    useBoardStore.getState().updateElement('a', { x: 50 });
    vi.advanceTimersByTime(5);
    // collaborator recolors the same element
    useBoardStore.getState().applyServerElement(rect('a', { x: 50, fill: '#f00', version: 2 }));
    useBoardStore.getState().undo();
    expect(el('a')).toMatchObject({ x: 0, fill: '#f00' });
    useBoardStore.getState().redo();
    expect(el('a')).toMatchObject({ x: 50, fill: '#f00' });
  });

  it('groups changes made in one tick (multi-select drag) into one step', () => {
    useBoardStore.getState().updateElement('a', { x: 10 });
    useBoardStore.getState().updateElement('b', { x: 20 });
    vi.advanceTimersByTime(5);
    expect(useBoardStore.getState().history).toHaveLength(1);
    useBoardStore.getState().undo();
    expect(el('a')!.x).toBe(0);
    expect(el('b')!.x).toBe(0);
  });

  it('coalesces typing into a single undo step', () => {
    for (const content of ['h', 'he', 'hel', 'hello']) {
      useBoardStore.getState().updateElement('a', { content });
      vi.advanceTimersByTime(100);
    }
    expect(useBoardStore.getState().history).toHaveLength(1);
    useBoardStore.getState().undo();
    expect(el('a')!.content).toBe('');
  });

  it('undoing a delete recreates the element and syncs it', () => {
    useBoardStore.getState().removeElements(['b']);
    vi.advanceTimersByTime(5);
    useBoardStore.getState().undo();
    expect(el('b')).toBeDefined();
    const ops = vi.mocked(enqueueElementOp).mock.calls.map(([, op]) => op.type);
    expect(ops).toEqual(['delete', 'create']);
  });

  it('does not resurrect an element a collaborator deleted when undoing an edit', () => {
    useBoardStore.getState().updateElement('a', { x: 5 });
    vi.advanceTimersByTime(5);
    useBoardStore.getState().removeElementLocal('a');
    useBoardStore.getState().undo();
    expect(el('a')).toBeUndefined();
  });

  it('refuses local edits for viewers', () => {
    useBoardStore.setState({ canEdit: false });
    useBoardStore.getState().updateElement('a', { x: 5 });
    expect(el('a')!.x).toBe(0);
    expect(enqueueElementOp).not.toHaveBeenCalled();
  });
});

describe('comment threads', () => {
  const comment = (id: string, extra: object) => ({
    id,
    boardId: '1',
    author: { id: '1', name: 'A', color: '#000' },
    text: id,
    createdAt: '2026-01-01T00:00:00Z',
    ...extra,
  });

  it('pins element threads to the element and keeps free pins in world space', () => {
    const threads = buildThreads(
      [rect('a', { x: 100, y: 40, width: 50, scaleX: 2 })],
      [
        comment('1', { elementId: 'a', x: 1, y: 1 }),
        comment('2', { elementId: 'a', x: 9, y: 9 }),
        comment('3', { x: 300.2, y: -20 }),
        comment('4', { x: 300.4, y: -20.1 }),
        comment('5', {}),
      ],
    );
    expect(threads).toHaveLength(2);
    const onElement = threads.find((t) => t.elementId === 'a')!;
    // top-right corner of the scaled element
    expect(onElement).toMatchObject({ x: 200, y: 40 });
    expect(onElement.comments.map((c) => c.id)).toEqual(['1', '2']);
    expect(threads.find((t) => !t.elementId)!.comments).toHaveLength(2);
  });

  it('falls back to the absolute anchor when the element is gone', () => {
    const [t] = buildThreads([], [comment('1', { elementId: 'gone', x: 5, y: 6 })]);
    expect(t).toMatchObject({ x: 5, y: 6, elementId: undefined });
  });
});
