import { z } from 'zod';

const snapshotElementSchema = z
  .object({
    id: z.string().min(1).max(64),
  })
  .catchall(z.unknown());

export const createVersionSchema = z.object({
  snapshot: z.array(snapshotElementSchema).max(10_000).optional(),
  label: z.string().trim().min(1).max(120).optional(),
});

export const versionIdParamSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  versionId: z.coerce.number().int().positive(),
});

export const boardIdParamSchema = z.object({
  boardId: z.coerce.number().int().positive(),
});

export default { createVersionSchema, versionIdParamSchema, boardIdParamSchema };