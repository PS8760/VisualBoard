import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import prisma from '../../config/prisma.js';
import { badRequestError, notFoundError } from '../../utils/errors.js';
import { MimePolicy, DocumentErrors } from './document.constants.js';
import { MAX_UPLOAD_BYTES } from './document.validation.js';
import { getStorage } from '../../services/storage/index.js';

/** Sanitizes the original filename: keeps a readable base + safe characters only. */
export function sanitizeFileName(name: string): string {
  const base = (name || 'document').replace(/[^\w.\- ]+/g, '').trim().slice(0, 180);
  const withExt = base || 'document.pdf';
  return withExt.replace(/\.+/g, '.');
}

/** Generates a collision-resistant storage key. Never derived from user input. */
export function makeStorageKey(originalName: string, _mimeType: string): string {
  const ext = extname(originalName).replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) || '.bin';
  return `${Date.now()}_${randomBytes(12).toString('hex')}${ext}`;
}

export function validateUpload(mimeType: string | undefined, size: number): void {
  if (!mimeType || !MimePolicy.ALLOWED.has(mimeType)) {
    throw badRequestError(DocumentErrors.INVALID_TYPE);
  }
  if (size > MAX_UPLOAD_BYTES) {
    throw badRequestError(DocumentErrors.TOO_LARGE);
  }
}

/** Stores bytes via the configured driver and persists metadata. */
export async function storeDocument(
  boardId: number,
  userId: number,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  elementId?: string,
) {
  validateUpload(file.mimetype, file.size);

  if (elementId) {
    const element = await prisma.elements.findUnique({
      where: { id: elementId },
      select: { board_id: true },
    });
    if (!element) throw badRequestError('Referenced element does not exist');
    if (element.board_id !== boardId) throw badRequestError('Referenced element belongs to another board');
  }

  const originalName = sanitizeFileName(file.originalname);
  const storageKey = makeStorageKey(originalName, file.mimetype);
  const storage = getStorage();
  await storage.save(storageKey, file.buffer, file.mimetype);

  return prisma.documents.create({
    data: {
      board_id: boardId,
      user_id: userId,
      element_id: elementId ?? null,
      original_name: originalName,
      stored_name: storageKey,
      mime_type: file.mimetype,
      size: file.size,
    },
  });
}

export const listDocumentsByBoard = async (boardId: number) => {
  return prisma.documents.findMany({
    where: { board_id: boardId },
    orderBy: { created_at: 'desc' },
    include: { users: { select: { id: true, name: true, avatar: true } } },
  });
};

export const getDocumentById = async (id: number) => {
  return prisma.documents.findUnique({ where: { id } });
};

export const deleteDocument = async (id: number) => {
  const doc = await prisma.documents.findUnique({ where: { id } });
  if (!doc) throw notFoundError(DocumentErrors.NOT_FOUND);
  await prisma.documents.delete({ where: { id } });
  return doc;
};

export default { sanitizeFileName, makeStorageKey, validateUpload, storeDocument, listDocumentsByBoard, getDocumentById, deleteDocument };