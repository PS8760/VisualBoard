import { z } from 'zod';

export const joinBoardSchema = z.object({
  boardId: z.coerce.number().int().positive(),
});

export const cursorUpdateSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  x: z.number().finite(),
  y: z.number().finite(),
  tool: z.string().max(32).optional(),
});

export const elementCreateSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  element: z.record(z.string(), z.unknown()),
});

export const elementUpdateSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  id: z.string().min(1).max(64),
  patch: z.record(z.string(), z.unknown()),
});

export const elementDeleteSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  id: z.string().min(1).max(64),
});

export const commentCreateSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  content: z.string().trim().min(1).max(2000),
  element_id: z.string().min(1).max(64).nullish(),
  x: z.number().finite().nullish(),
  y: z.number().finite().nullish(),
});

export default {
  joinBoardSchema,
  cursorUpdateSchema,
  elementCreateSchema,
  elementUpdateSchema,
  elementDeleteSchema,
  commentCreateSchema,
};