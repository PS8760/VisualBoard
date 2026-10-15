import { randomBytes } from 'node:crypto';
import { extname } from 'node:path';
import { Prisma } from '@prisma/client';
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

/**
 * Magic-number signatures for the types clients render inline (image / PDF
 * previews). The declared MIME type is client-controlled, so a mismatch is
 * rejected instead of letting arbitrary bytes masquerade as a previewable file.
 */
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': (b) => b.length >= 8 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a,
  'image/jpeg': (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) => ['GIF87a', 'GIF89a'].includes(b.subarray(0, 6).toString('latin1')),
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
};

export function assertContentMatchesType(mimeType: string, data: Buffer): void {
  const check = SIGNATURES[mimeType];
  if (check && !check(data)) {
    throw badRequestError('File contents do not match the declared file type');
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
  assertContentMatchesType(file.mimetype, file.buffer);

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

  try {
    return await prisma.documents.create({
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
  } catch (err) {
    // Metadata failed (e.g. board deleted mid-upload): don't orphan the bytes.
    await storage.delete(storageKey).catch(() => undefined);
    throw err;
  }
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

/**
 * Deletes the document row and strips the attachment from any element that
 * still references it (bumping the element version), all in one transaction.
 * Returns the affected element rows so callers can broadcast them.
 */
export const deleteDocument = async (id: number) => {
  return prisma.$transaction(async (tx) => {
    const doc = await tx.documents.findUnique({ where: { id } });
    if (!doc) throw notFoundError(DocumentErrors.NOT_FOUND);
    await tx.documents.delete({ where: { id } });
    const detached = await tx.$queryRaw<Array<{ id: string; element_data: Prisma.JsonValue }>>`
      UPDATE "elements"
         SET "element_data" = jsonb_set(
               "element_data" - 'attachment',
               '{version}',
               to_jsonb(CASE WHEN jsonb_typeof("element_data"->'version') = 'number'
                             THEN floor(("element_data"->>'version')::numeric)::int ELSE 0 END + 1)
             ),
             "updated_at" = now()
       WHERE "board_id" = ${doc.board_id}
         AND "element_data"->'attachment'->>'id' = ${String(id)}
   RETURNING "id", "element_data"`;
    return { doc, detached };
  });
};

export default { sanitizeFileName, makeStorageKey, validateUpload, assertContentMatchesType, storeDocument, listDocumentsByBoard, getDocumentById, deleteDocument };