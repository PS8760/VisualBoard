import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { notFoundError, badRequestError, conflictError } from '../../utils/errors.js';
import { noteBoardMutation } from '../version/version.autosnapshot.js';

type ElementRow = {
  id: string;
  board_id: number;
  element_data: Prisma.JsonValue;
  created_at: Date | null;
  updated_at: Date | null;
};

/** Fields the server owns — clients can never set them through a patch. */
function stripServerFields(data: Record<string, unknown>) {
  const { id: _id, version: _version, ...rest } = data;
  void _id;
  void _version;
  return rest;
}

/**
 * Creates an element.
 *
 * - `overwrite: false` (realtime default) makes creation idempotent: replaying
 *   the same create after a reconnect returns the stored row untouched instead
 *   of clobbering edits other collaborators made in between.
 * - `overwrite: true` (REST PUT-like semantics) replaces the stored data.
 *
 * Element ids are global primary keys; an id that already belongs to another
 * board is rejected so one board can never write into another.
 */
export const createElement = async (
  boardId: number,
  elementData: Record<string, unknown>,
  id: string,
  opts: { overwrite?: boolean; userId?: number } = {},
) => {
  const existing = await prisma.elements.findUnique({ where: { id } });
  if (existing && existing.board_id !== boardId) {
    throw conflictError('Element id is already in use');
  }

  if (existing) {
    if (!opts.overwrite) return existing;
    const current = existing.element_data as Record<string, unknown>;
    const version = (typeof current.version === 'number' ? current.version : 0) + 1;
    const row = await prisma.elements.update({
      where: { id },
      data: { element_data: { ...stripServerFields(elementData), id, version } as object },
    });
    noteBoardMutation(boardId, opts.userId);
    return row;
  }

  try {
    const row = await prisma.elements.create({
      data: {
        id,
        board_id: boardId,
        element_data: { ...stripServerFields(elementData), id, version: 1 } as object,
      },
    });
    noteBoardMutation(boardId, opts.userId);
    return row;
  } catch (err) {
    // Lost a create race for the same id — both clients wanted the same row.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const row = await prisma.elements.findUnique({ where: { id } });
      if (row && row.board_id === boardId) return row;
      throw conflictError('Element id is already in use');
    }
    throw err;
  }
};

export const listElementsByBoard = async (boardId: number) => {
  return prisma.elements.findMany({ where: { board_id: boardId }, orderBy: [{ created_at: 'asc' }, { id: 'asc' }] });
};

export const getElementById = async (id: string) => {
  return prisma.elements.findUnique({ where: { id } });
};

/**
 * Applies a partial patch atomically inside Postgres.
 *
 * `element_data || patch` merges at the row level under the row lock, so two
 * collaborators patching different fields of the same element concurrently
 * never lose each other's change (a read-modify-write in Node would). The
 * server-owned `version` is incremented in the same statement, which gives
 * clients a monotonic per-element ordering to discard stale broadcasts.
 */
export const updateElement = async (
  boardId: number,
  id: string,
  patch: Record<string, unknown>,
  opts: { userId?: number } = {},
) => {
  const clean = stripServerFields(patch);
  const rows = await prisma.$queryRaw<ElementRow[]>`
    UPDATE "elements"
       SET "element_data" = jsonb_set(
             "element_data" || ${JSON.stringify(clean)}::jsonb || jsonb_build_object('id', "id"),
             '{version}',
             to_jsonb(
               CASE WHEN jsonb_typeof("element_data"->'version') = 'number'
                    THEN floor(("element_data"->>'version')::numeric)::int
                    ELSE 0 END + 1
             )
           ),
           "updated_at" = now()
     WHERE "id" = ${id} AND "board_id" = ${boardId}
 RETURNING "id", "board_id", "element_data", "created_at", "updated_at"`;

  const row = rows[0];
  if (!row) throw notFoundError('Element not found');
  noteBoardMutation(boardId, opts.userId);
  return row;
};

export const replaceElementData = async (
  boardId: number,
  id: string,
  elementData: Record<string, unknown>,
  opts: { userId?: number } = {},
) => {
  const existing = await prisma.elements.findUnique({ where: { id } });
  if (!existing || existing.board_id !== boardId) throw notFoundError('Element not found');
  return createElement(boardId, elementData, id, { overwrite: true, userId: opts.userId });
};

/**
 * Deletes an element and un-pins any comment threads anchored to it (threads
 * keep their absolute x/y so they stay where they were on the canvas).
 *
 * Attached documents are board-scoped: the FK sets their element_id to NULL and
 * the bytes are kept, so restoring an older version that still references the
 * attachment keeps working. Files are reclaimed when the document itself or
 * the board is deleted.
 *
 * Returns `deleted: false` when the element was already gone — deletes are
 * idempotent so a replayed operation after a reconnect is harmless.
 */
export const deleteElement = async (boardId: number, id: string, opts: { userId?: number } = {}) => {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.elements.deleteMany({ where: { id, board_id: boardId } });
    if (!count) return { deleted: false, unpinnedCommentIds: [] as number[] };

    const pinned = await tx.comments.findMany({
      where: { board_id: boardId, element_id: id },
      select: { id: true },
    });
    if (pinned.length) {
      await tx.comments.updateMany({ where: { board_id: boardId, element_id: id }, data: { element_id: null } });
    }
    noteBoardMutation(boardId, opts.userId);
    return { deleted: true, unpinnedCommentIds: pinned.map((c) => c.id) };
  });
};

/**
 * Bulk synchronization: the client sends its full element set and the server
 * reconciles it against the database inside a single transaction.
 *
 * Kept for API clients and imports; the web app persists through granular
 * realtime operations instead, because a full replace from a stale client
 * deletes whatever collaborators added since that client last synced.
 */
export const bulkSyncElements = async (
  boardId: number,
  elements: Array<{ id: string; [key: string]: unknown }>,
  opts: { userId?: number } = {},
) => {
  const result = await prisma.$transaction(async (tx) => {
    const ids = elements.map((e) => e.id).filter(Boolean);

    const existing = await tx.elements.findMany({ where: { board_id: boardId } });
    const existingById = new Map(existing.map((e) => [e.id, e]));

    // bulkSync is a full replace: an empty payload would delete everything.
    // Refuse while the board still has content so a stale client (old tab,
    // missed realtime events) can never wipe the board in a single call.
    if (elements.length === 0 && existing.length > 0) {
      throw badRequestError('Refusing to clear all elements in a single bulk sync');
    }

    const toDelete = existing.filter((e) => !ids.includes(e.id));
    if (toDelete.length) {
      await tx.elements.deleteMany({ where: { board_id: boardId, id: { notIn: ids } } });
    }

    const toCreate = elements
      .filter((e) => !existingById.has(e.id))
      .map((e) => ({ id: e.id, board_id: boardId, element_data: { ...stripServerFields(e), id: e.id, version: 1 } as object }));
    const toUpdate = elements.filter((e) => existingById.has(e.id));

    if (toCreate.length) await tx.elements.createMany({ data: toCreate });
    for (const el of toUpdate) {
      const current = existingById.get(el.id)!.element_data as Record<string, unknown>;
      const version = (typeof current.version === 'number' ? current.version : 0) + 1;
      await tx.elements.update({
        where: { id: el.id },
        data: { element_data: { ...stripServerFields(el), id: el.id, version } as object },
      });
    }

    return { created: toCreate.length, updated: toUpdate.length, removed: toDelete.length };
  });
  noteBoardMutation(boardId, opts.userId);
  return result;
};

export default { createElement, listElementsByBoard, getElementById, updateElement, replaceElementData, deleteElement, bulkSyncElements };
