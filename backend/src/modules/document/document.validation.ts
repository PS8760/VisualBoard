import { z } from 'zod';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const documentIdParamSchema = z.object({
  documentId: z.coerce.number().int().positive(),
});

export const boardIdParamSchema = z.object({
  boardId: z.coerce.number().int().positive(),
});

export const attachSchema = z.object({
  elementId: z.string().min(1).max(64).optional(),
});

export default { documentIdParamSchema, boardIdParamSchema, attachSchema, MAX_UPLOAD_BYTES };