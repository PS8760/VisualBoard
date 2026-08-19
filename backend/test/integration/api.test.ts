import { describe, expect, it, beforeAll, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import { hashPassword } from '../../src/utils/hash.js';
import prisma from '../../src/config/prisma.js';

const PASSWORD = 'Password123!';

async function registerUser(email: string, name: string) {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({ email, name, password: PASSWORD });
  expect(res.status).toBe(201);
  return res.body.data as { token: string; user: { id: number; email: string; name: string; role: string } };
}

async function login(email: string) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);
  return { token: res.body.data.token as string, user: res.body.data.user };
}

const VALID_ELEMENT = {
  id: 'el_test_1',
  kind: 'rect',
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  rotation: 0,
  fill: '#d9480f',
  stroke: '#3a2c16',
  strokeWidth: 2,
  content: '',
  version: 1,
};

describe('API integration', () => {
  let owner: { token: string; user: { id: number } };
  let editor: { token: string; user: { id: number } };
  let viewer: { token: string; user: { id: number } };
  let outsider: { token: string };
  let boardId: number;
  let commentId: number;

beforeAll(async () => {
      await prisma.boards.deleteMany();
      await prisma.users.deleteMany();
      const o = await registerUser('owner-test@example.com', 'Owner Test');
      const e = await registerUser('editor-test@example.com', 'Editor Test');
      const v = await registerUser('viewer-test@example.com', 'Viewer Test');
      const oo = await registerUser('outsider-test@example.com', 'Outsider Test');
      owner = { token: o.token, user: o.user };
      editor = { token: e.token, user: e.user };
      viewer = { token: v.token, user: v.user };
      outsider = { token: oo.token };
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

  describe('auth', () => {
    it('rejects duplicate registration', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'owner-test@example.com', name: 'Dup', password: PASSWORD });
      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ success: false, error: { code: 'CONFLICT' } });
    });

    it('rejects a weak password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'weak@example.com', name: 'Weak', password: 'short' });
      expect(res.status).toBe(422);
    });

    it('rejects bad credentials on login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'owner-test@example.com', password: 'nope' });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns the me profile', async () => {
      const res = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('owner-test@example.com');
    });

    it('rejects requests without a token', async () => {
      const res = await request(app).get('/api/v1/boards');
      expect(res.status).toBe(401);
    });

    it('returns 404 for unknown routes even when authenticated', async () => {
      const res = await request(app).get('/api/v1/nope').set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for malformed JSON', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send('{bad');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BAD_REQUEST');
    });
  });

  describe('boards + RBAC', () => {
    it('creates a board with implicit owner membership', async () => {
      const res = await request(app)
        .post('/api/v1/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Integration Board' });
      expect(res.status).toBe(201);
      boardId = res.body.data.id;

      const members = await request(app)
        .get(`/api/v1/boards/${boardId}/members`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(members.status).toBe(200);
      expect(members.body.data).toHaveLength(1);
      expect(members.body.data[0]).toMatchObject({ role: 'owner', user_id: owner.user.id });
    });

    it('lists the board for the owner', async () => {
      const res = await request(app).get('/api/v1/boards').set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((b: { id: number }) => b.id === boardId)).toBe(true);
    });

    it('adds members and rejects duplicates', async () => {
      const addEditor = await request(app)
        .post(`/api/v1/boards/${boardId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: editor.user.id, role: 'editor' });
      expect(addEditor.status).toBe(201);

      const addViewer = await request(app)
        .post(`/api/v1/boards/${boardId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: viewer.user.id, role: 'viewer' });
      expect(addViewer.status).toBe(201);

      const dup = await request(app)
        .post(`/api/v1/boards/${boardId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: editor.user.id, role: 'editor' });
      expect(dup.status).toBe(409);
    });

    it('rejects invalid roles', async () => {
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: 999, role: 'admin' });
      expect(res.status).toBe(422);
    });

    it('rejects non-members', async () => {
      const res = await request(app).get(`/api/v1/boards/${boardId}`).set('Authorization', `Bearer ${outsider.token}`);
      expect(res.status).toBe(403);
    });

    it('viewer cannot create elements or delete the board', async () => {
      const create = await request(app)
        .post(`/api/v1/boards/${boardId}/elements`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ element: VALID_ELEMENT });
      expect(create.status).toBe(403);

      const del = await request(app)
        .delete(`/api/v1/boards/${boardId}`)
        .set('Authorization', `Bearer ${viewer.token}`);
      expect(del.status).toBe(403);
    });

    it('prevents removing the last owner', async () => {
      const res = await request(app)
        .delete(`/api/v1/boards/${boardId}/members/${owner.user.id}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('owner cannot be demoted', async () => {
      const res = await request(app)
        .put(`/api/v1/boards/${boardId}/members/${owner.user.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ role: 'editor' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('LAST_OWNER');
    });

    it('promotes a member to owner and demotes back', async () => {
      const promote = await request(app)
        .put(`/api/v1/boards/${boardId}/members/${editor.user.id}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ role: 'owner' });
      expect(promote.status).toBe(200);

      const demoteBack = await request(app)
        .put(`/api/v1/boards/${boardId}/members/${editor.user.id}`)
        .set('Authorization', `Bearer ${editor.token}`)
        .send({ role: 'editor' });
      expect(demoteBack.status).toBe(200);
    });
  });

  describe('elements', () => {
    it('creates an element', async () => {
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/elements`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ element: VALID_ELEMENT });
      expect(res.status).toBe(201);
      expect(res.body.data.id).toBe('el_test_1');
    });

    it('rejects an invalid element shape', async () => {
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/elements`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ element: { ...VALID_ELEMENT, kind: 'nope' } });
      expect(res.status).toBe(422);
    });

    it('patches an element', async () => {
      const res = await request(app)
        .patch(`/api/v1/boards/${boardId}/elements/el_test_1`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ patch: { x: 99, version: 2 } });
      expect(res.status).toBe(200);
      expect(res.body.data.element_data.x).toBe(99);
    });

    it('rejects patches containing invalid or oversized fields', async () => {
      const res = await request(app)
        .patch(`/api/v1/boards/${boardId}/elements/el_test_1`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ patch: { content: 'x'.repeat(150_000) } });
      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      const badKind = await request(app)
        .patch(`/api/v1/boards/${boardId}/elements/el_test_1`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ patch: { kind: 'octagon' } });
      expect(badKind.status).toBe(422);
    });

    it('syncs elements in bulk (create + update + delete)', async () => {
      const bulk = await request(app)
        .put(`/api/v1/boards/${boardId}/elements/bulk`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({
          elements: [
            { ...VALID_ELEMENT, id: 'el_bulk_1' },
            { ...VALID_ELEMENT, id: 'el_bulk_2', kind: 'text', content: 'hi' },
          ],
        });
      expect(bulk.status).toBe(200);
      expect(bulk.body.data).toMatchObject({ created: 2, updated: 0, removed: 1 });

      const update = await request(app)
        .put(`/api/v1/boards/${boardId}/elements/bulk`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ elements: [{ ...VALID_ELEMENT, id: 'el_bulk_1' }, { ...VALID_ELEMENT, id: 'el_bulk_2' }] });
      expect(update.body.data).toMatchObject({ created: 0, updated: 2, removed: 0 });

      const remove = await request(app)
        .put(`/api/v1/boards/${boardId}/elements/bulk`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ elements: [{ ...VALID_ELEMENT, id: 'el_bulk_1' }] });
      expect(remove.status).toBe(200);
      expect(remove.body.data.removed).toBe(1);

      const list = await request(app)
        .get(`/api/v1/boards/${boardId}/elements`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(list.status).toBe(200);
      const ids = list.body.data.map((e: { id: string }) => e.id);
      expect(ids).toContain('el_bulk_1');
      expect(ids).not.toContain('el_bulk_2');
    });

    it('rejects bulk payloads over the size limit', async () => {
      const tooMany = Array.from({ length: 5001 }, (_, i) => ({ ...VALID_ELEMENT, id: `el_x_${i}` }));
      const res = await request(app)
        .put(`/api/v1/boards/${boardId}/elements/bulk`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ elements: tooMany });
      expect(res.status).toBe(422);
    });
  });

  describe('comments', () => {
    it('creates a comment on the board', async () => {
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/comments`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ content: 'first comment', x_position: 12, y_position: 34 });
      expect(res.status).toBe(201);
      commentId = res.body.data.id;
      expect(res.body.data.content).toBe('first comment');
    });

    it('lists comments with author', async () => {
      const res = await request(app)
        .get(`/api/v1/boards/${boardId}/comments`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(200);
      expect(res.body.data.some((c: { id: number }) => c.id === commentId)).toBe(true);
    });

    it('only the author can update/delete', async () => {
      const res = await request(app)
        .put(`/api/v1/boards/${boardId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${editor.token}`)
        .send({ content: 'hijacked' });
      expect(res.status).toBe(403);

      const ok = await request(app)
        .put(`/api/v1/boards/${boardId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ content: 'updated' });
      expect(ok.status).toBe(200);

      const del = await request(app)
        .delete(`/api/v1/boards/${boardId}/comments/${commentId}`)
        .set('Authorization', `Bearer ${editor.token}`);
      expect(del.status).toBe(403);
    });

    it('rejects empty comments', async () => {
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/comments`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ content: '' });
      expect(res.status).toBe(422);
    });
  });

  describe('versions', () => {
    it('snapshots current elements, restores an old snapshot', async () => {
      const snap = await request(app)
        .post(`/api/v1/boards/${boardId}/versions`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ label: 'test snapshot' });
      expect(snap.status).toBe(201);

      await request(app)
        .patch(`/api/v1/boards/${boardId}/elements/el_bulk_1`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ patch: { x: 555 } });

      const snapshotId = snap.body.data.id;
      const restore = await request(app)
        .post(`/api/v1/boards/${boardId}/versions/${snapshotId}/restore`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(restore.status).toBe(200);
      expect(restore.body.data.restored_elements).toBeGreaterThan(0);

      const list = await request(app)
        .get(`/api/v1/boards/${boardId}/elements`)
        .set('Authorization', `Bearer ${owner.token}`);
      const restored = list.body.data.find((e: { id: string }) => e.id === 'el_bulk_1');
      expect(restored).toBeDefined();
      expect(restored.element_data.x).toBe(10);
    });

    it('rejects versions by non-members', async () => {
      const res = await request(app)
        .get(`/api/v1/boards/${boardId}/versions`)
        .set('Authorization', `Bearer ${outsider.token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('documents', () => {
    it('uploads, lists, downloads and deletes a document', async () => {
      const bytes = Buffer.from('%PDF-1.4 fake pdf content');
      const up = await request(app)
        .post(`/api/v1/boards/${boardId}/documents`)
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('file', bytes, {
          filename: 'report.pdf',
          contentType: 'application/pdf',
        });
      expect(up.status).toBe(201);
      const docId = up.body.data.id;
      expect(up.body.data.original_name).toBe('report.pdf');

      const list = await request(app)
        .get(`/api/v1/boards/${boardId}/documents`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(list.body.data.some((d: { id: number }) => d.id === docId)).toBe(true);

      const dl = await request(app)
        .get(`/api/v1/documents/${docId}/download`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(dl.status).toBe(200);
      expect(dl.headers['content-disposition']).toContain('report.pdf');
      expect(dl.body.toString()).toBe(bytes.toString());

      const del = await request(app)
        .delete(`/api/v1/documents/${docId}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(del.status).toBe(200);
    });

    it('rejects disallowed mime types', async () => {
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/documents`)
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('file', Buffer.from('evil'), {
          filename: 'evil.exe',
          contentType: 'application/x-msdownload',
        });
      expect(res.status).toBe(400);
    });

    it('rejects oversized uploads', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024, 1);
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/documents`)
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('file', big, { filename: 'big.pdf', contentType: 'application/pdf' });
      expect(res.status).toBe(413);
    });
  });

  describe('user account endpoints', () => {
    let pwBoardId: number;

    it('searches users by email and excludes the caller', async () => {
      const res = await request(app)
        .get('/api/v1/users/search')
        .query({ email: 'test@example' })
        .set('Authorization', `Bearer ${owner.token}`);
      expect(res.status).toBe(200);
      const emails = res.body.data.map((u: { email: string }) => u.email);
      expect(emails).toContain('editor-test@example.com');
      expect(emails).toContain('viewer-test@example.com');
      expect(emails).not.toContain('owner-test@example.com');
    });

    it('requires auth to search users', async () => {
      const res = await request(app).get('/api/v1/users/search').query({ email: 'test@example' });
      expect(res.status).toBe(401);
    });

    it('rejects a wrong current password', async () => {
      const res = await request(app)
        .post('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ currentPassword: 'WrongPass123!', newPassword: 'NewPassword123!' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects a weak new password', async () => {
      const res = await request(app)
        .post('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ currentPassword: PASSWORD, newPassword: 'short' });
      expect(res.status).toBe(422);
    });

    it('changes the password and the new one works', async () => {
      const change = await request(app)
        .post('/api/v1/users/me/password')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ currentPassword: PASSWORD, newPassword: 'NewPassword123!' });
      expect(change.status).toBe(200);
      expect(change.body.data.updated).toBe(true);

      const oldLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'owner-test@example.com', password: PASSWORD });
      expect(oldLogin.status).toBe(401);

      const newLogin = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'owner-test@example.com', password: 'NewPassword123!' });
      expect(newLogin.status).toBe(200);
    });

    it('uploads and serves an avatar, rejecting bad types', async () => {
      const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
      const ok = await request(app)
        .post('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('avatar', png, { filename: 'me.png', contentType: 'image/png' });
      expect(ok.status).toBe(200);
      const avatarPath = ok.body.data.avatar as string;
      expect(avatarPath).toContain(`/api/v1/users/${owner.user.id}/avatar`);

      const me = await request(app).get('/api/v1/users/me').set('Authorization', `Bearer ${owner.token}`);
      expect(me.body.data.avatar).toBe(avatarPath);

      const served = await request(app).get(avatarPath);
      expect(served.status).toBe(200);
      expect(served.type).toBe('image/png');

      const bad = await request(app)
        .post('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${owner.token}`)
        .attach('avatar', Buffer.from('MZ90'), { filename: 'evil.exe', contentType: 'application/octet-stream' });
      expect(bad.status).toBe(400);

      const missing = await request(app)
        .post('/api/v1/users/me/avatar')
        .set('Authorization', `Bearer ${owner.token}`);
      expect(missing.status).toBe(400);
    });
  });

  describe('member invites + AI suggestions', () => {
    let suggBoardId: number;
    const fixture = {
      suggestions: [
        { title: 'Add a gateway', detail: 'Centralise entry', category: 'architecture', priority: 'medium' },
        { title: 'Encrypt at rest', detail: 'Protect data', category: 'security', priority: 'high' },
      ],
    };

    it('invites a member by email and rejects unknown accounts', async () => {
      const board = await request(app)
        .post('/api/v1/boards')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ title: 'Invite Board' });
      expect(board.status).toBe(201);
      suggBoardId = board.body.data.id;

      const invite = await request(app)
        .post(`/api/v1/boards/${suggBoardId}/members/invite`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: 'viewer-test@example.com', role: 'viewer' });
      expect(invite.status).toBe(201);
      expect(invite.body.data.user.email).toBe('viewer-test@example.com');

      const missing = await request(app)
        .post(`/api/v1/boards/${suggBoardId}/members/invite`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ email: 'nobody@example.com', role: 'editor' });
      expect(missing.status).toBe(404);

      const forbidden = await request(app)
        .post(`/api/v1/boards/${suggBoardId}/members/invite`)
        .set('Authorization', `Bearer ${viewer.token}`)
        .send({ email: 'editor-test@example.com', role: 'viewer' });
      expect(forbidden.status).toBe(403);
    });

    it('returns 503 when AI suggestions are not configured', async () => {
      vi.resetModules();
      vi.doMock('../../src/config/env.js', () => ({
        env: {
          DATABASE_URL: process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/visualboard_test',
          JWT_SECRET: process.env.JWT_SECRET ?? 'dev-only-change-me-please-use-a-long-random-secret',
          GROQ_API_KEY: undefined,
          GROQ_MODEL: 'openai/gpt-oss-120b',
          FRONTEND_ORIGIN: ['http://localhost:5173'],
          LOG_LEVEL: 'silent',
          NODE_ENV: 'test',
        },
        isProd: false,
        isTest: true,
        isDev: false,
        corsOrigins: ['http://localhost:5173'],
        oauthConfigured: { github: false, google: false },
        suggestionsConfigured: false,
        default: {},
      }));
      const { default: app2 } = await import('../../src/app.js');
      const res = await request(app2)
        .post(`/api/v1/boards/${suggBoardId}/suggestions`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({});
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('returns AI suggestions for a board owner', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify(fixture) } }],
          }),
        })),
      );
      const res = await request(app)
        .post(`/api/v1/boards/${suggBoardId}/suggestions`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ prompt: 'help me improve this board architecture' });
      expect(res.status).toBe(200);
      expect(res.body.data.suggestions).toHaveLength(2);
      expect(res.body.data.suggestions[0]).toMatchObject({
        title: 'Add a gateway',
        category: 'architecture',
        priority: 'medium',
      });
      expect(res.body.data.suggestions[1].category).toBe('security');
    });

    it('rejects suggestions for non-members', async () => {
      const res = await request(app)
        .post(`/api/v1/boards/${suggBoardId}/suggestions`)
        .set('Authorization', `Bearer ${outsider.token}`)
        .send({});
      expect(res.status).toBe(403);
    });

    it('rejects suggestions for a missing board', async () => {
      const res = await request(app)
        .post('/api/v1/boards/999999/suggestions')
        .set('Authorization', `Bearer ${owner.token}`)
        .send({});
      expect(res.status).toBe(404);
    });
  });

  describe('board deletion', () => {
    it('deletes the board and its contents, then 404s', async () => {
      const del = await request(app)
        .delete(`/api/v1/boards/${boardId}`)
        .set('Authorization', `Bearer ${owner.token}`);
      expect(del.status).toBe(200);

      const gone = await request(app).get(`/api/v1/boards/${boardId}`).set('Authorization', `Bearer ${editor.token}`);
      expect(gone.status).toBe(404);
    });
  });
});