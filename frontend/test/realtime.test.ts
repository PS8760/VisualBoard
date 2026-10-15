import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Board, BoardElement } from '../src/types';

vi.mock('../src/api/element.api', () => ({
  fetchElements: vi.fn(),
  saveElements: vi.fn(),
}));
vi.mock('../src/api/version.api', () => ({
  fetchVersions: vi.fn().mockResolvedValue([]),
  createVersion: vi.fn(),
  restoreVersion: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() }) }));

import * as elementApi from '../src/api/element.api';
import { useBoardStore } from '../src/stores/useBoardStore';
import { usePresenceStore } from '../src/stores/usePresenceStore';
import { attachRealtimeListeners, enqueueElementOp, pendingCount, resetRealtime } from '../src/services/realtime';

type Ack = { ok: boolean; code?: string; message?: string; element?: BoardElement };
interface Sent {
  event: string;
  payload: Record<string, unknown>;
  ack: (err: Error | null, res?: Ack) => void;
}

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

function fakeSocket() {
  const sent: Sent[] = [];
  const handlers = new Map<string, Array<(...a: unknown[]) => void>>();
  const socket = {
    id: 'sock-1',
    connected: true,
    on: (e: string, fn: (...a: unknown[]) => void) => handlers.set(e, [...(handlers.get(e) ?? []), fn]),
    off: (e: string, fn: (...a: unknown[]) => void) => handlers.set(e, (handlers.get(e) ?? []).filter((f) => f !== fn)),
    emit: vi.fn(),
    volatile: { emit: vi.fn() },
    timeout: () => ({
      emit: (event: string, payload: Record<string, unknown>, ack: Sent['ack']) => sent.push({ event, payload, ack }),
    }),
  };
  const fire = (event: string, payload: unknown) => (handlers.get(event) ?? []).forEach((fn) => fn(payload));
  return { socket, sent, fire };
}

describe('realtime sync engine', () => {
  let detach: () => void;
  let io: ReturnType<typeof fakeSocket>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    resetRealtime();
    io = fakeSocket();
    useBoardStore.setState({
      board: board([rect('a')]),
      isDemo: false,
      canEdit: true,
      history: [],
      future: [],
      selectedIds: [],
      saveStatus: { state: 'saved' },
    });
    usePresenceStore.setState({ socket: io.socket, mode: 'live', status: 'connected', joinedBoardId: '1' });
    detach = attachRealtimeListeners();
  });

  afterEach(() => {
    detach();
    resetRealtime();
    vi.useRealTimers();
  });

  it('coalesces rapid updates to one element into a single write', () => {
    const { updateElement } = useBoardStore.getState();
    updateElement('a', { x: 1 });
    updateElement('a', { x: 2 });
    updateElement('a', { fill: '#f00' });
    vi.advanceTimersByTime(50);
    expect(io.sent).toHaveLength(1);
    expect(io.sent[0]).toMatchObject({ event: 'element:updated', payload: { id: 'a', patch: { x: 2, fill: '#f00' } } });
  });

  it('keeps one in-flight op per element so the server applies them in order', () => {
    const store = useBoardStore.getState();
    store.addElement(rect('b', { version: 0 }));
    vi.advanceTimersByTime(50);
    store.updateElement('b', { x: 10 });
    vi.advanceTimersByTime(50);
    // update waits for the create ack
    expect(io.sent.map((s) => s.event)).toEqual(['element:created']);
    io.sent[0]!.ack(null, { ok: true, element: rect('b', { version: 1 }) });
    vi.advanceTimersByTime(50);
    expect(io.sent.map((s) => s.event)).toEqual(['element:created', 'element:updated']);
    io.sent[1]!.ack(null, { ok: true, element: rect('b', { x: 10, version: 2 }) });
    expect(pendingCount('1')).toBe(0);
    expect(useBoardStore.getState().saveStatus.state).toBe('saved');
  });

  it('never sends a create that was deleted before it left the client', () => {
    const store = useBoardStore.getState();
    store.addElement(rect('tmp', { version: 0 }));
    store.removeElements(['tmp']);
    vi.advanceTimersByTime(50);
    expect(io.sent).toHaveLength(0);
    expect(pendingCount()).toBe(0);
  });

  it('discards stale broadcasts and rebases pending local edits on fresh ones', () => {
    useBoardStore.setState({ board: board([rect('a', { version: 5, x: 50 })]) });
    io.fire('element:updated', { boardId: 1, id: 'a', element: rect('a', { version: 4, x: 999 }) });
    expect(useBoardStore.getState().board!.elements[0]!.x).toBe(50);

    // local edit in flight + newer remote change to another field
    useBoardStore.getState().updateElement('a', { x: 60 });
    io.fire('element:updated', { boardId: 1, id: 'a', element: rect('a', { version: 6, x: 50, fill: '#0f0' }) });
    const el = useBoardStore.getState().board!.elements[0]!;
    expect(el).toMatchObject({ x: 60, fill: '#0f0', version: 6 });
  });

  it('rolls back to server state when an op is rejected', async () => {
    vi.mocked(elementApi.fetchElements).mockResolvedValue({ ok: true, elements: [rect('a', { x: 0, version: 3 })] });
    useBoardStore.getState().updateElement('a', { x: 77 });
    vi.advanceTimersByTime(50);
    io.sent[0]!.ack(null, { ok: false, code: 'REJECTED', message: 'nope' });
    await vi.runAllTimersAsync();
    expect(elementApi.fetchElements).toHaveBeenCalledWith('1');
    expect(useBoardStore.getState().board!.elements[0]).toMatchObject({ x: 0, version: 3 });
  });

  it('removes an element locally when the server says it no longer exists', () => {
    useBoardStore.getState().updateElement('a', { x: 5 });
    vi.advanceTimersByTime(50);
    io.sent[0]!.ack(null, { ok: false, code: 'NOT_FOUND' });
    expect(useBoardStore.getState().board!.elements).toHaveLength(0);
  });

  it('queues offline and rebases the queue on the server state after rejoining', async () => {
    usePresenceStore.setState({ joinedBoardId: null, status: 'reconnecting' });
    const store = useBoardStore.getState();
    store.updateElement('a', { x: 42 });
    store.addElement(rect('c', { version: 0 }));
    vi.advanceTimersByTime(50);
    expect(io.sent).toHaveLength(0);
    expect(useBoardStore.getState().saveStatus).toMatchObject({ state: 'offline' });

    // meanwhile a collaborator changed another field and added an element
    vi.mocked(elementApi.fetchElements).mockResolvedValue({
      ok: true,
      elements: [rect('a', { version: 9, fill: '#123' }), rect('remote', { version: 1 })],
    });
    usePresenceStore.setState({ joinedBoardId: '1', status: 'connected' });
    await vi.runAllTimersAsync();

    const ids = useBoardStore.getState().board!.elements.map((e) => e.id);
    expect(ids).toEqual(['a', 'remote', 'c']);
    expect(useBoardStore.getState().board!.elements[0]).toMatchObject({ x: 42, fill: '#123', version: 9 });
    expect(io.sent.map((s) => s.event).sort()).toEqual(['element:created', 'element:updated']);
  });

  it('retries after an ack timeout (ops are idempotent)', async () => {
    useBoardStore.getState().updateElement('a', { x: 3 });
    vi.advanceTimersByTime(50);
    io.sent[0]!.ack(new Error('timeout'));
    await vi.advanceTimersByTimeAsync(3_000);
    expect(io.sent).toHaveLength(2);
    expect(io.sent[1]!.payload).toMatchObject({ id: 'a', patch: { x: 3 } });
  });

  it('applies a restore broadcast wholesale and drops queued pre-restore edits', () => {
    usePresenceStore.setState({ joinedBoardId: null });
    useBoardStore.getState().updateElement('a', { x: 1 });
    io.fire('board:restored', { boardId: 1, elements: [rect('old', { version: 4 })], restoredBy: 2 });
    expect(useBoardStore.getState().board!.elements.map((e) => e.id)).toEqual(['old']);
    expect(useBoardStore.getState().history).toHaveLength(0);
    expect(pendingCount('1')).toBe(0);
  });

  it('sends element creates without client-side versions (server owns them)', () => {
    enqueueElementOp('1', { type: 'create', id: 'z', element: rect('z', { version: 99 }) });
    vi.advanceTimersByTime(50);
    expect(io.sent[0]!.payload.element).not.toHaveProperty('version');
  });
});
