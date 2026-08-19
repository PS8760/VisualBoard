import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../src/api/client', () => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  apiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'Request failed'),
}));

import { client } from '../src/api/client';
import * as boardApi from '../src/api/board.api';
import * as userApi from '../src/api/user.api';
import * as suggestionsApi from '../src/api/suggestions.api';

const get = vi.mocked(client.get);
const post = vi.mocked(client.post);
const put = vi.mocked(client.put);
const del = vi.mocked(client.delete);

describe('board.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps a list response into BoardSummary rows', async () => {
    get.mockResolvedValue({
      data: {
        data: [
          {
            id: 3,
            title: 'Checkout',
            description: 'Payments flow',
            owner_id: 1,
            role: 'owner',
            created_at: '2026-08-19T10:00:00Z',
            updated_at: '2026-08-19T11:00:00Z',
            _count: { elements: 12, comments: 3, documents: 1 },
          },
        ],
      },
    });

    const rows = await boardApi.listBoards();
    expect(get).toHaveBeenCalledWith('/boards');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: '3',
      title: 'Checkout',
      role: 'owner',
      elementCount: 12,
      commentCount: 3,
      documentCount: 1,
    });
  });

  it('maps a full board including members for mapBoard', () => {
    const board = boardApi.mapBoard({
      id: 5,
      title: 'T',
      owner_id: 2,
      created_at: '2026-08-19T10:00:00Z',
      updated_at: '2026-08-19T10:00:00Z',
      board_members: [
        { role: 'editor', users: { id: 2, name: 'Ada', email: 'ada@x.com' } },
      ],
    });
    expect(board.id).toBe('5');
    expect(board.members[0]).toMatchObject({ name: 'Ada', role: 'editor', initials: 'A' });
  });

  it('creates a board and maps the response', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          id: 9,
          title: 'New',
          owner_id: 1,
          created_at: '2026-08-19T10:00:00Z',
          updated_at: '2026-08-19T10:00:00Z',
        },
      },
    });
    const board = await boardApi.createBoard('New', 'desc');
    expect(post).toHaveBeenCalledWith('/boards', { title: 'New', description: 'desc' });
    expect(board?.id).toBe('9');
    expect(board?.title).toBe('New');
  });

  it('updates and deletes boards', async () => {
    put.mockResolvedValue({ data: { data: { id: 1 } } });
    del.mockResolvedValue({ data: {} });

    const upd = await boardApi.updateBoard('1', { title: 'Renamed', description: null });
    expect(put).toHaveBeenCalledWith('/boards/1', { title: 'Renamed', description: null });
    expect(upd.ok).toBe(true);

    const delRes = await boardApi.deleteBoard('1');
    expect(del).toHaveBeenCalledWith('/boards/1');
    expect(delRes.ok).toBe(true);
  });
});

describe('user.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('searches users and maps results', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 4, name: 'Bob', email: 'bob@x.com' }] } });
    const results = await userApi.searchUsers('bob');
    expect(get).toHaveBeenCalledWith('/users/search', { params: { email: 'bob' } });
    expect(results).toEqual([{ id: '4', name: 'Bob', email: 'bob@x.com', avatar: undefined }]);
  });

  it('changes password and surfaces errors', async () => {
    post.mockResolvedValue({ data: { data: { updated: true } } });
    const ok = await userApi.changePassword('old', 'NewPassword123!');
    expect(post).toHaveBeenCalledWith('/users/me/password', {
      currentPassword: 'old',
      newPassword: 'NewPassword123!',
    });
    expect(ok.ok).toBe(true);

    post.mockRejectedValue(Object.assign(new Error('bad'), { response: { status: 403 } }));
    const fail = await userApi.changePassword('wrong', 'NewPassword123!');
    expect(fail.ok).toBe(false);
  });

  it('uploads an avatar as multipart form data', async () => {
    post.mockResolvedValue({ data: { data: { avatar: '/api/v1/users/1/avatar?v=1' } } });
    const file = new File(['x'], 'a.png', { type: 'image/png' });
    const res = await userApi.uploadAvatar(file);
    expect(post).toHaveBeenCalledTimes(1);
    const [url, form, config] = post.mock.calls[0] as [string, FormData, { headers: Record<string, string> }];
    expect(url).toBe('/users/me/avatar');
    expect(form.get('avatar')).toBe(file);
    expect(config.headers['Content-Type']).toBe('multipart/form-data');
    expect(res).toEqual({ ok: true, avatar: '/api/v1/users/1/avatar?v=1' });
  });

  it('invites members and updates roles', async () => {
    post.mockResolvedValue({ data: { data: {} } });
    put.mockResolvedValue({ data: { data: {} } });

    const invite = await userApi.inviteMember('2', 'bob@x.com', 'editor');
    expect(post).toHaveBeenCalledWith('/boards/2/members/invite', { email: 'bob@x.com', role: 'editor' });
    expect(invite.ok).toBe(true);

    const role = await userApi.updateMemberRole('2', '4', 'viewer');
    expect(put).toHaveBeenCalledWith('/boards/2/members/4', { role: 'viewer' });
    expect(role.ok).toBe(true);
  });

  it('fetches members into User rows with role mapping', async () => {
    get.mockResolvedValue({
      data: {
        data: [
          { user_id: 4, role: 'owner', user: { id: 4, name: 'Bob', email: 'bob@x.com' } },
          { user_id: 5, role: 'viewer', user: { id: 5, name: 'Sal', email: 'sal@x.com' } },
        ],
      },
    });
    const members = await userApi.fetchBoardMembers('2');
    expect(members).toHaveLength(2);
    expect(members[0]).toMatchObject({ role: 'owner', name: 'Bob' });
    expect(members[1]).toMatchObject({ role: 'viewer', name: 'Sal' });
  });
});

describe('suggestions.api', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts a board analysis request and returns suggestions', async () => {
    post.mockResolvedValue({
      data: {
        data: {
          suggestions: [
            { id: 'ai_1', title: 'Add a gateway', detail: 'd', category: 'architecture', priority: 'high' },
          ],
          model: 'openai/gpt-oss-120b',
        },
      },
    });
    const res = await suggestionsApi.fetchBoardSuggestions('2', 'focus on auth');
    expect(post).toHaveBeenCalledWith('/boards/2/suggestions', { prompt: 'focus on auth' });
    expect(res.ok).toBe(true);
    expect(res.data?.suggestions[0].title).toBe('Add a gateway');
  });

  it('returns error message when the backend is unavailable', async () => {
    post.mockRejectedValue(Object.assign(new Error('nope'), { response: { status: 503 } }));
    const res = await suggestionsApi.fetchBoardSuggestions('2');
    expect(res.ok).toBe(false);
    expect(typeof res.message).toBe('string');
  });
});