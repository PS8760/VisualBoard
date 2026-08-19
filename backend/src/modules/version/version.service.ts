import prisma from '../../config/prisma.js';
import { notFoundError } from '../../utils/errors.js';

type SnapshotElement = { id: string; [key: string]: unknown };

/** Builds a consistent snapshot from the current board elements. */
export const buildSnapshot = async (boardId: number): Promise<SnapshotElement[]> => {
  const elements = await prisma.elements.findMany({
    where: { board_id: boardId },
    orderBy: { created_at: 'asc' },
  });
  return elements.map((el) => ({ ...(el.element_data as object), id: el.id }));
};

/** Persists a snapshot of the board's current state as a new version row. */
export const createVersion = async (
  boardId: number,
  createdBy: number,
  snapshot?: SnapshotElement[],
) => {
  const snapshotData = snapshot ?? (await buildSnapshot(boardId));
  return prisma.versions.create({
    data: { board_id: boardId, created_by: createdBy, snapshot: snapshotData as object },
  });
};

export const listVersionsByBoard = async (boardId: number, limit = 100) => {
  return prisma.versions.findMany({
    where: { board_id: boardId },
    orderBy: { created_at: 'desc' },
    take: limit,
    include: {
      users: { select: { id: true, name: true } },
    },
  });
};

export const getVersionById = async (id: number) => {
  return prisma.versions.findUnique({ where: { id } });
};

/**
 * Atomically restores a board to a snapshot:
 *  1. saves the current state as a new version (safety copy)
 *  2. replaces the board's elements with the snapshot
 * Both steps run in one transaction — a failure rolls everything back.
 */
export const restoreVersion = async (id: number, restoredBy: number) => {
  const version = await prisma.versions.findUnique({ where: { id } });
  if (!version) throw notFoundError('Version not found');

  const boardId = version.board_id;
  const snapshot = Array.isArray(version.snapshot) ? (version.snapshot as SnapshotElement[]) : [];

  return prisma.$transaction(async (tx) => {
    const current = await tx.elements.findMany({ where: { board_id: boardId } });
    await tx.versions.create({
      data: {
        board_id: boardId,
        created_by: restoredBy,
        snapshot: current.map((el) => ({ ...(el.element_data as object), id: el.id })) as object,
      },
    });

    await tx.elements.deleteMany({ where: { board_id: boardId } });
    if (snapshot.length > 0) {
      await tx.elements.createMany({
        data: snapshot.map((el) => ({
          id: el.id,
          board_id: boardId,
          element_data: el as object,
        })),
      });
    }

    return { board_id: boardId, restored_elements: snapshot.length };
  });
};

export default { buildSnapshot, createVersion, listVersionsByBoard, getVersionById, restoreVersion };