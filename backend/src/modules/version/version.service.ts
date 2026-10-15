import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '../../config/prisma.js';
import { notFoundError, badRequestError } from '../../utils/errors.js';
import { registerSnapshotWriter, cancelBoardSnapshot } from './version.autosnapshot.js';

type SnapshotElement = { id: string; [key: string]: unknown };

/** Versions kept per board; older rows are pruned after each write. */
export const MAX_VERSIONS_PER_BOARD = 100;

export const VersionLabels = {
  MANUAL: 'Manual snapshot',
  AUTO: 'Auto-save',
  BEFORE_RESTORE: 'Before restore',
} as const;

/**
 * Old rows stored snapshots as `{ elements: [...] }` instead of a bare array.
 * Restore must understand both shapes — treating the object as "no snapshot"
 * used to wipe the whole board on restore.
 */
export function normalizeSnapshot(raw: unknown): SnapshotElement[] {
  if (Array.isArray(raw)) return raw as SnapshotElement[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as { elements?: unknown }).elements)) {
    return (raw as { elements: SnapshotElement[] }).elements;
  }
  return [];
}

/** Key-order independent JSON so jsonb round-trips hash identically. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** Content hash of a snapshot, ignoring server bookkeeping (version counters). */
export function snapshotHash(elements: SnapshotElement[]): string {
  const stripped = [...elements]
    .map(({ version: _v, ...rest }) => {
      void _v;
      return rest;
    })
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return createHash('sha1').update(canonical(stripped)).digest('hex');
}

/** Builds a consistent snapshot from the current board elements. */
export const buildSnapshot = async (
  boardId: number,
  client: Prisma.TransactionClient = prisma,
): Promise<SnapshotElement[]> => {
  const elements = await client.elements.findMany({
    where: { board_id: boardId },
    orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
  });
  return elements.map((el) => ({ ...(el.element_data as object), id: el.id }));
};

async function pruneVersions(boardId: number, client: Prisma.TransactionClient = prisma) {
  const stale = await client.versions.findMany({
    where: { board_id: boardId },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    skip: MAX_VERSIONS_PER_BOARD,
    select: { id: true },
  });
  if (stale.length) {
    await client.versions.deleteMany({ where: { id: { in: stale.map((v) => v.id) } } });
  }
}

/** Persists a snapshot of the board's current state as a new version row. */
export const createVersion = async (
  boardId: number,
  createdBy: number,
  snapshot?: SnapshotElement[],
  label: string = VersionLabels.MANUAL,
) => {
  const snapshotData = snapshot ?? (await buildSnapshot(boardId));
  const version = await prisma.versions.create({
    data: { board_id: boardId, created_by: createdBy, snapshot: snapshotData as object, label },
  });
  // A manual checkpoint supersedes a pending auto-save of the same state.
  cancelBoardSnapshot(boardId);
  await pruneVersions(boardId);
  return version;
};

/**
 * Writes an automatic snapshot unless the board is unchanged since the latest
 * version (or is empty). Returns the new row, or null when skipped.
 */
export const createAutoVersion = async (boardId: number, userId: number) => {
  const board = await prisma.boards.findUnique({ where: { id: boardId }, select: { id: true } });
  if (!board) return null;

  const snapshot = await buildSnapshot(boardId);
  if (!snapshot.length) return null;

  const latest = await prisma.versions.findFirst({
    where: { board_id: boardId },
    orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    select: { snapshot: true },
  });
  if (latest && snapshotHash(normalizeSnapshot(latest.snapshot)) === snapshotHash(snapshot)) {
    return null;
  }

  const version = await prisma.versions.create({
    data: { board_id: boardId, created_by: userId, snapshot: snapshot as object, label: VersionLabels.AUTO },
  });
  await pruneVersions(boardId);
  return version;
};

registerSnapshotWriter(createAutoVersion);

export type VersionSummary = {
  id: number;
  board_id: number;
  created_by: number;
  created_at: Date | null;
  label: string | null;
  element_count: number;
  users: { id: number; name: string } | null;
};

/**
 * Timeline listing. Returns metadata + element counts only — shipping every
 * full snapshot (up to 100 × board size) on each open of the timeline does not
 * scale. Use `getVersionById` for the snapshot body.
 */
export const listVersionsByBoard = async (boardId: number, limit = MAX_VERSIONS_PER_BOARD): Promise<VersionSummary[]> => {
  const rows = await prisma.$queryRaw<
    Array<{ id: number; board_id: number; created_by: number; created_at: Date | null; label: string | null; element_count: number; user_name: string | null }>
  >`
    SELECT v."id", v."board_id", v."created_by", v."created_at", v."label",
           (CASE jsonb_typeof(v."snapshot")
              WHEN 'array' THEN jsonb_array_length(v."snapshot")
              WHEN 'object' THEN CASE WHEN jsonb_typeof(v."snapshot"->'elements') = 'array'
                                      THEN jsonb_array_length(v."snapshot"->'elements') ELSE 0 END
              ELSE 0 END)::int AS "element_count",
           u."name" AS "user_name"
      FROM "versions" v
      LEFT JOIN "users" u ON u."id" = v."created_by"
     WHERE v."board_id" = ${boardId}
     ORDER BY v."created_at" DESC, v."id" DESC
     LIMIT ${limit}`;

  return rows.map(({ user_name, ...row }) => ({
    ...row,
    users: user_name !== null ? { id: row.created_by, name: user_name } : null,
  }));
};

export const getVersionById = async (id: number) => {
  return prisma.versions.findUnique({ where: { id } });
};

/**
 * Atomically restores a board to a snapshot:
 *  1. saves the current state as a new version (safety copy)
 *  2. replaces the board's elements with the snapshot
 * Both steps run in one transaction — a failure rolls everything back.
 *
 * Restored elements get a version strictly greater than anything clients have
 * seen for that id, so a pre-restore broadcast still in flight can never
 * overwrite the restored state on a collaborator's screen.
 */
export const restoreVersion = async (boardId: number, id: number, restoredBy: number) => {
  const version = await prisma.versions.findUnique({ where: { id } });
  // Scope check: a version id from another board must never be restorable here.
  if (!version || version.board_id !== boardId) throw notFoundError('Version not found');

  const snapshot = normalizeSnapshot(version.snapshot).filter(
    (el): el is SnapshotElement => !!el && typeof el.id === 'string' && el.id.length > 0 && el.id.length <= 64,
  );

  // Never let an empty/unreadable snapshot destroy existing board content.
  if (snapshot.length === 0) {
    const count = await prisma.elements.count({ where: { board_id: boardId } });
    if (count > 0) {
      throw badRequestError('This snapshot contains no restorable elements — restore cancelled to protect the board');
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.elements.findMany({ where: { board_id: boardId } });
    const currentVersions = new Map(
      current.map((el) => {
        const v = (el.element_data as Record<string, unknown>).version;
        return [el.id, typeof v === 'number' ? v : 0];
      }),
    );

    await tx.versions.create({
      data: {
        board_id: boardId,
        created_by: restoredBy,
        label: VersionLabels.BEFORE_RESTORE,
        snapshot: current.map((el) => ({ ...(el.element_data as object), id: el.id })) as object,
      },
    });

    // Ids that now live on another board (e.g. copied snapshot) cannot be reused.
    const foreign = await tx.elements.findMany({
      where: { id: { in: snapshot.map((el) => el.id) }, board_id: { not: boardId } },
      select: { id: true },
    });
    const foreignIds = new Set(foreign.map((f) => f.id));

    const restored = snapshot
      .filter((el) => !foreignIds.has(el.id))
      .map((el) => {
        const snapVersion = typeof el.version === 'number' ? el.version : 0;
        const version = Math.max(snapVersion, currentVersions.get(el.id) ?? 0) + 1;
        return { ...el, version };
      });

    await tx.elements.deleteMany({ where: { board_id: boardId } });
    if (restored.length > 0) {
      await tx.elements.createMany({
        data: restored.map((el) => ({ id: el.id, board_id: boardId, element_data: el as object })),
      });
    }
    await pruneVersions(boardId, tx);

    return { board_id: boardId, version_id: id, restored_elements: restored.length, elements: restored };
  });

  cancelBoardSnapshot(boardId);
  return result;
};

export default { buildSnapshot, createVersion, createAutoVersion, listVersionsByBoard, getVersionById, restoreVersion, normalizeSnapshot, snapshotHash };
