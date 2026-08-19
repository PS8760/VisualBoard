import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Board, CommentItem } from '../src/types';
import { useBoardStore } from '../src/stores/useBoardStore';

vi.mock('../src/api/board.api', () => ({
  fetchBoard: vi.fn(),
  createBoard: vi.fn(),
  listBoards: vi.fn(),
}));
vi.mock('../src/api/element.api', () => ({
  saveElements: vi.fn().mockResolvedValue({ ok: true }),
  createElement: vi.fn(),
  patchElement: vi.fn(),
  replaceElement: vi.fn(),
  deleteElement: vi.fn(),
}));
vi.mock('../src/api/comment.api', () => ({
  fetchComments: vi.fn(),
  createComment: vi.fn(),
  deleteComment: vi.fn(),
}));
vi.mock('../src/api/version.api', () => ({
  fetchVersions: vi.fn().mockResolvedValue([]),
  createVersion: vi.fn(),
  restoreVersion: vi.fn(),
}));

import * as boardApi from '../src/api/board.api';
import * as commentApi from '../src/api/comment.api';
import { demoBoard, demoComments } from '../src/data/demo';

const mockedBoard = (overrides: Partial<Board> = {}): Board => ({
  id: '1',
  title: 'Integration Board',
  ownerId: '1',
  createdAt: '2026-08-19T10:00:00Z',
  updatedAt: '2026-08-19T10:05:00Z',
  elements: [
    {
      id: 'el_1',
      kind: 'rect',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      rotation: 0,
      fill: '#d9480f',
      stroke: '#3a2c16',
      strokeWidth: 2,
      content: '',
      version: 1,
    },
  ],
  members: [{ id: '1', name: 'Owner', email: 'o@x.com', color: '#d9480f', initials: 'O', role: 'owner' }],
  ...overrides,
});

describe('useBoardStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useBoardStore.setState({
      board: null,
      comments: [],
      versions: [],
      loading: false,
      error: null,
      isDemo: false,
      selectedIds: [],
      saveStatus: { state: 'idle' },
      history: [],
      future: [],
      arranged: false,
      revision: 0,
    });
  });

  it('loads a real board and its comments when the API succeeds', async () => {
    const comments: CommentItem[] = [{ id: 'c1', boardId: '1', author: { id: '2', name: 'A', color: '#000', initials: 'A' }, text: 'hi', createdAt: '2026-08-19T10:01:00Z' }];
    vi.mocked(boardApi.fetchBoard).mockResolvedValue({ ok: true, board: mockedBoard(), message: null });
    vi.mocked(commentApi.fetchComments).mockResolvedValue(comments);

    const store = useBoardStore.getState();
    await store.load('1');
    const s = useBoardStore.getState();
    expect(s.isDemo).toBe(false);
    expect(s.error).toBeNull();
    expect(s.board?.id).toBe('1');
    expect(s.board?.elements).toHaveLength(1);
    expect(s.comments).toEqual(comments);
  });

  it('falls back to demo data when the board API fails', async () => {
    vi.mocked(boardApi.fetchBoard).mockResolvedValue({ ok: false, board: null, message: 'Backend unreachable' });
    vi.mocked(commentApi.fetchComments).mockResolvedValue([]);

    const store = useBoardStore.getState();
    await store.load('99');
    const s = useBoardStore.getState();
    expect(s.isDemo).toBe(true);
    expect(s.board?.id).toBe('99');
    expect(s.board.elements).toEqual(demoBoard.elements);
    expect(s.comments).toEqual(demoComments);
    expect(s.saveStatus.state).toBe('offline');
  });

  it('adds a comment locally and swaps in the server copy', async () => {
    vi.mocked(boardApi.fetchBoard).mockResolvedValue({ ok: true, board: mockedBoard(), message: null });
    vi.mocked(commentApi.fetchComments).mockResolvedValue([]);
    vi.mocked(commentApi.createComment).mockResolvedValue({
      id: 'c_server',
      boardId: '1',
      author: { id: 'u_local', name: 'You', color: '#d9480f', initials: 'Y' },
      text: 'hello',
      createdAt: '2026-08-19T10:02:00Z',
    });

    await useBoardStore.getState().load('1');
    useBoardStore.getState().addComment('hello');

    const afterAdd = useBoardStore.getState();
    expect(afterAdd.comments).toHaveLength(1);
    expect(afterAdd.comments[0].text).toBe('hello');

    const localId = afterAdd.comments[0].id;
    await vi.waitFor(() => {
      expect(useBoardStore.getState().comments[0].id).toBe('c_server');
    });
    expect(useBoardStore.getState().comments[0].id).not.toBe(localId);
  });

  it('removes a comment and notifies the API', async () => {
    vi.mocked(boardApi.fetchBoard).mockResolvedValue({ ok: true, board: mockedBoard(), message: null });
    vi.mocked(commentApi.fetchComments).mockResolvedValue([
      { id: 'c1', boardId: '1', author: { id: '2', name: 'A', color: '#000', initials: 'A' }, text: 'hi', createdAt: '2026-08-19T10:01:00Z' },
    ]);
    vi.mocked(commentApi.deleteComment).mockResolvedValue({ ok: true });

    await useBoardStore.getState().load('1');
    useBoardStore.getState().removeComment('c1');
    expect(useBoardStore.getState().comments).toHaveLength(0);
    expect(commentApi.deleteComment).toHaveBeenCalledWith('1', 'c1');
  });
});