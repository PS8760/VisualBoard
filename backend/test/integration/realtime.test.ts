import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as ioClient, type Socket } from 'socket.io-client';
import app from '../../src/app.js';
import initSocket from '../../src/modules/socket/socket.js';
import prisma from '../../src/config/prisma.js';
import { createAutoVersion, MAX_VERSIONS_PER_BOARD } from '../../src/modules/version/version.service.js';

type Ack = { ok: boolean; code?: string; message?: string; element?: Record<string, unknown>; [k: string]: unknown };

const PASSWORD = 'Password123!';
const RECT = { kind: 'rect', x: 0, y: 0, width: 100, height: 60, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 1, content: '' };

async function register(email: string, name: string) {
  const res = await request(app).post('/api/v1/auth/register').send({ email, name, password: PASSWORD });
  expect(res.status).toBe(201);
  return res.body.data as { token: string; user: { id: number } };
}

describe('realtime collaboration', () => {
  let server: http.Server;
  let url: string;
  let owner: { token: string; user: { id: number } };
  let editor: { token: string; user: { id: number } };
  let viewer: { token: string; user: { id: number } };
  let boardId: number;
  let otherBoardId: number;
  const sockets: Socket[] = [];

  const connect = async (token: string) => {
    const socket = ioClient(url, { auth: { token }, transports: ['websocket'], forceNew: true, reconnection: false });
    sockets.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    return socket;
  };

  const emit = (socket: Socket, event: string, payload: unknown) =>
    socket.timeout(5000).emitWithAck(event, payload) as Promise<Ack>;

  const next = <T>(socket: Socket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, (payload: T) => resolve(payload)));

  beforeAll(async () => {
    await prisma.boards.deleteMany();
    await prisma.users.deleteMany();
    owner = await register('rt-owner@example.com', 'RT Owner');
    editor = await register('rt-editor@example.com', 'RT Editor');
    viewer = await register('rt-viewer@example.com', 'RT Viewer');

    const board = await request(app).post('/api/v1/boards').set('Authorization', `Bearer ${owner.token}`).send({ title: 'RT' });
    boardId = board.body.data.id;
    const other = await request(app).post('/api/v1/boards').set('Authorization', `Bearer ${editor.token}`).send({ title: 'Other' });
    otherBoardId = other.body.data.id;
    for (const [user, role] of [[editor, 'editor'], [viewer, 'viewer']] as const) {
      const res = await request(app)
        .post(`/api/v1/boards/${boardId}/members`)
        .set('Authorization', `Bearer ${owner.token}`)
        .send({ userId: user.user.id, role });
      expect(res.status).toBe(201);
    }

    server = http.createServer(app);
    initSocket(server);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    sockets.forEach((s) => s.close());
    await new Promise((resolve) => server.close(resolve));
  });

  it('rejects unauthenticated sockets', async () => {
    const socket = ioClient(url, { auth: { token: 'nope' }, transports: ['websocket'], forceNew: true, reconnection: false });
    const err = await new Promise<Error>((resolve) => socket.once('connect_error', resolve));
    expect(err.message).toBe('ERR_UNAUTHORIZED');
    socket.close();
  });

  it('acks joins with the caller role and refuses non-members', async () => {
    const a = await connect(owner.token);
    expect(await emit(a, 'board:join', { boardId })).toMatchObject({ ok: true, role: 'owner' });
    const outsider = await connect(editor.token);
    expect(await emit(outsider, 'board:join', { boardId: 999_999 })).toMatchObject({ ok: false, code: 'FORBIDDEN' });
  });

  it('persists, acks and broadcasts element lifecycle with server versions', async () => {
    const a = await connect(owner.token);
    const b = await connect(editor.token);
    await emit(a, 'board:join', { boardId });
    await emit(b, 'board:join', { boardId });

    const created = next<{ element: Record<string, unknown>; by: string }>(b, 'element:created');
    const ack = await emit(a, 'element:created', { boardId, element: { ...RECT, id: 'rt_el_1', version: 42 } });
    expect(ack.ok).toBe(true);
    // version is server-owned: clients cannot forge it
    expect(ack.element).toMatchObject({ id: 'rt_el_1', version: 1 });
    expect((await created).element).toMatchObject({ id: 'rt_el_1', version: 1 });

    const updated = next<{ element: Record<string, unknown> }>(b, 'element:updated');
    const upd = await emit(a, 'element:updated', { boardId, id: 'rt_el_1', patch: { x: 50 } });
    expect(upd.element).toMatchObject({ x: 50, version: 2 });
    expect((await updated).element).toMatchObject({ x: 50, version: 2 });

    const removed = next<{ id: string }>(b, 'element:removed');
    expect(await emit(a, 'element:removed', { boardId, id: 'rt_el_1' })).toMatchObject({ ok: true });
    expect((await removed).id).toBe('rt_el_1');

    // replayed delete (e.g. after reconnect) is idempotent
    expect(await emit(a, 'element:removed', { boardId, id: 'rt_el_1' })).toMatchObject({ ok: true });
    // update of a deleted element is a precise, rollback-able failure
    expect(await emit(a, 'element:updated', { boardId, id: 'rt_el_1', patch: { x: 1 } })).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
  });

  it('replayed creates are idempotent and never clobber newer edits', async () => {
    const a = await connect(owner.token);
    await emit(a, 'board:join', { boardId });
    await emit(a, 'element:created', { boardId, element: { ...RECT, id: 'rt_el_replay' } });
    await emit(a, 'element:updated', { boardId, id: 'rt_el_replay', patch: { x: 300 } });
    const replay = await emit(a, 'element:created', { boardId, element: { ...RECT, id: 'rt_el_replay' } });
    expect(replay.element).toMatchObject({ x: 300, version: 2 });
  });

  it('patches legacy rows that never stored their id inside element_data', async () => {
    const a = await connect(owner.token);
    await emit(a, 'board:join', { boardId });
    await prisma.elements.create({ data: { id: 'rt_legacy', board_id: boardId, element_data: { ...RECT } } });
    const ack = await emit(a, 'element:updated', { boardId, id: 'rt_legacy', patch: { x: 5 } });
    expect(ack.element).toMatchObject({ id: 'rt_legacy', x: 5, version: 1 });
  });

  it('merges concurrent patches to different fields without losing either', async () => {
    const a = await connect(owner.token);
    const b = await connect(editor.token);
    await emit(a, 'board:join', { boardId });
    await emit(b, 'board:join', { boardId });
    await emit(a, 'element:created', { boardId, element: { ...RECT, id: 'rt_el_race' } });

    const writes = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0
        ? emit(a, 'element:updated', { boardId, id: 'rt_el_race', patch: { x: i } })
        : emit(b, 'element:updated', { boardId, id: 'rt_el_race', patch: { fill: `#00000${i % 10}` } }),
    );
    const acks = await Promise.all(writes);
    expect(acks.every((r) => r.ok)).toBe(true);

    const row = await prisma.elements.findUnique({ where: { id: 'rt_el_race' } });
    const data = row!.element_data as Record<string, unknown>;
    expect(data.version).toBe(21);
    expect(typeof data.x).toBe('number');
    expect(String(data.fill)).toMatch(/^#00000\d$/);
    // every write got a unique version — no lost update
    const versions = acks.map((r) => (r.element as { version: number }).version).sort((x, y) => x - y);
    expect(new Set(versions).size).toBe(20);
  });

  it('enforces roles, validation and board scoping on the socket', async () => {
    const v = await connect(viewer.token);
    await emit(v, 'board:join', { boardId });
    expect(await emit(v, 'element:created', { boardId, element: { ...RECT, id: 'rt_viewer' } })).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });

    const e = await connect(editor.token);
    await emit(e, 'board:join', { boardId });
    expect(await emit(e, 'element:created', { boardId, element: { ...RECT, kind: 'octagon' } })).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    // sending to a board the socket never joined is refused
    expect(await emit(e, 'element:created', { boardId: otherBoardId, element: { ...RECT, id: 'rt_x' } })).toMatchObject({
      ok: false,
      code: 'NOT_JOINED',
    });

    // an id owned by another board can't be hijacked through this board
    await prisma.elements.create({ data: { id: 'rt_foreign', board_id: otherBoardId, element_data: { ...RECT, id: 'rt_foreign' } } });
    expect(await emit(e, 'element:created', { boardId, element: { ...RECT, id: 'rt_foreign', x: 999 } })).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    });
    expect(await emit(e, 'element:updated', { boardId, id: 'rt_foreign', patch: { x: 999 } })).toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
    const foreign = await prisma.elements.findUnique({ where: { id: 'rt_foreign' } });
    expect((foreign!.element_data as { x: number }).x).toBe(0);
  });

  it('un-pins comment threads when their element is deleted', async () => {
    const a = await connect(owner.token);
    const b = await connect(editor.token);
    await emit(a, 'board:join', { boardId });
    await emit(b, 'board:join', { boardId });
    await emit(a, 'element:created', { boardId, element: { ...RECT, id: 'rt_pinned' } });

    const comment = await request(app)
      .post(`/api/v1/boards/${boardId}/comments`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ content: 'pinned', element_id: 'rt_pinned', x: 10, y: 20 });
    expect(comment.status).toBe(201);
    expect(comment.body.data.users.name).toBe('RT Owner');

    const unpinned = next<{ comment: { id: number; element_id: string | null; x_position: number } }>(b, 'comment:updated');
    await emit(a, 'element:removed', { boardId, id: 'rt_pinned' });
    const payload = await unpinned;
    expect(payload.comment).toMatchObject({ id: comment.body.data.id, element_id: null, x_position: 10 });
  });

  it('broadcasts REST comments with the client id for optimistic reconciliation', async () => {
    const a = await connect(editor.token);
    await emit(a, 'board:join', { boardId });
    const echoed = next<{ clientId: string; comment: { content: string } }>(a, 'comment:created');
    await request(app)
      .post(`/api/v1/boards/${boardId}/comments`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({ content: 'hello room', clientId: 'c_temp_1' });
    expect(await echoed).toMatchObject({ clientId: 'c_temp_1', comment: { content: 'hello room' } });
  });

  it('restores a version for every connected client without disconnecting them', async () => {
    const a = await connect(owner.token);
    const b = await connect(editor.token);
    await emit(a, 'board:join', { boardId });
    await emit(b, 'board:join', { boardId });
    await emit(a, 'element:created', { boardId, element: { ...RECT, id: 'rt_ver', x: 1 } });

    const snap = await request(app)
      .post(`/api/v1/boards/${boardId}/versions`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ label: 'checkpoint' });
    expect(snap.status).toBe(201);
    expect(snap.body.data.label).toBe('checkpoint');

    const moved = await emit(b, 'element:updated', { boardId, id: 'rt_ver', patch: { x: 777 } });
    const preRestoreVersion = (moved.element as { version: number }).version;

    const restored = next<{ elements: Array<{ id: string; x: number; version: number }> }>(b, 'board:restored');
    const res = await request(app)
      .post(`/api/v1/boards/${boardId}/versions/${snap.body.data.id}/restore`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(200);

    const el = (await restored).elements.find((e) => e.id === 'rt_ver')!;
    expect(el.x).toBe(1);
    // restored rows outrank anything clients saw before, so stale broadcasts lose
    expect(el.version).toBeGreaterThan(preRestoreVersion);
    expect(b.connected).toBe(true);

    // the timeline lists metadata only, newest first, with labels and counts
    const list = await request(app).get(`/api/v1/boards/${boardId}/versions`).set('Authorization', `Bearer ${owner.token}`);
    expect(list.body.data[0]).toMatchObject({ label: 'Before restore' });
    expect(list.body.data[0].snapshot).toBeUndefined();
    expect(list.body.data[0].element_count).toBeGreaterThan(0);
  });

  it('refuses to restore a version that belongs to another board', async () => {
    const foreignVersion = await request(app)
      .post(`/api/v1/boards/${otherBoardId}/versions`)
      .set('Authorization', `Bearer ${editor.token}`)
      .send({});
    expect(foreignVersion.status).toBe(201);

    // owner of boardId tries to restore otherBoard's snapshot through their own board
    const res = await request(app)
      .post(`/api/v1/boards/${boardId}/versions/${foreignVersion.body.data.id}/restore`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(res.status).toBe(404);
    const peek = await request(app)
      .get(`/api/v1/boards/${boardId}/versions/${foreignVersion.body.data.id}`)
      .set('Authorization', `Bearer ${owner.token}`);
    expect(peek.status).toBe(404);
  });

  it('auto-snapshots skip unchanged boards and retention caps storage', async () => {
    await createAutoVersion(boardId, owner.user.id);
    const again = await createAutoVersion(boardId, owner.user.id);
    expect(again).toBeNull();

    for (let i = 0; i < MAX_VERSIONS_PER_BOARD + 5; i++) {
      await prisma.elements.update({
        where: { id: 'rt_ver' },
        data: { element_data: { ...RECT, id: 'rt_ver', x: 1000 + i } },
      });
      await createAutoVersion(boardId, owner.user.id);
    }
    expect(await prisma.versions.count({ where: { board_id: boardId } })).toBe(MAX_VERSIONS_PER_BOARD);
  });
});
