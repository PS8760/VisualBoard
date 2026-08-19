import prisma from '../../config/prisma.js';
import { notFoundError } from '../../utils/errors.js';

export const createElement = async (boardId: number, elementData: Record<string, unknown>, id: string) => {
  return prisma.elements.create({
    data: { id, board_id: boardId, element_data: elementData as object },
  });
};

export const listElementsByBoard = async (boardId: number) => {
  return prisma.elements.findMany({ where: { board_id: boardId }, orderBy: { created_at: 'asc' } });
};

export const getElementById = async (id: string) => {
  return prisma.elements.findUnique({ where: { id } });
};

export const updateElement = async (id: string, patch: Record<string, unknown>) => {
  const existing = await prisma.elements.findUnique({ where: { id } });
  if (!existing) throw notFoundError('Element not found');

  const current = existing.element_data as Record<string, unknown>;
  const merged = {
    ...current,
    ...patch,
    version: typeof patch.version === 'number' ? patch.version : (current.version as number | undefined ?? 0) + 1,
  };

  return prisma.elements.update({ where: { id }, data: { element_data: merged as object } });
};

export const replaceElementData = async (id: string, elementData: Record<string, unknown>) => {
  return prisma.elements.update({ where: { id }, data: { element_data: elementData as object } });
};

export const deleteElement = async (id: string) => {
  const existing = await prisma.elements.findUnique({ where: { id } });
  if (!existing) throw notFoundError('Element not found');

  const docs = await prisma.documents.findMany({ where: { element_id: id } });
  await prisma.elements.delete({ where: { id } });
  return docs.map((d) => d.stored_name);
};

/**
 * Bulk synchronization: the client sends its full element set and the server
 * reconciles it against the database inside a single transaction.
 */
export const bulkSyncElements = async (
  boardId: number,
  elements: Array<{ id: string; [key: string]: unknown }>,
) => {
  return prisma.$transaction(async (tx) => {
    const ids = elements.map((e) => e.id).filter(Boolean);

    const existing = await tx.elements.findMany({ where: { board_id: boardId } });
    const existingIds = new Set(existing.map((e) => e.id));

    const toDelete = existing.filter((e) => !ids.includes(e.id));
    if (toDelete.length) {
      await tx.elements.deleteMany({ where: { board_id: boardId, id: { notIn: ids } } });
    }

    const toCreate = elements
      .filter((e) => !existingIds.has(e.id))
      .map((e) => ({ id: e.id, board_id: boardId, element_data: e as object }));
    const toUpdate = elements.filter((e) => existingIds.has(e.id));

    if (toCreate.length) await tx.elements.createMany({ data: toCreate });
    for (const el of toUpdate) {
      await tx.elements.update({ where: { id: el.id }, data: { element_data: el as object } });
    }

    return { created: toCreate.length, updated: toUpdate.length, removed: toDelete.length };
  });
};

export default { createElement, listElementsByBoard, getElementById, updateElement, replaceElementData, deleteElement, bulkSyncElements };