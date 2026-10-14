import { z } from 'zod';
import { elementDataSchema, updateElementSchema } from '../element/element.validation.js';

const boardId = z.coerce.number().int().positive();
const elementId = z.string().min(1).max(64);

export const joinBoardSchema = z.object({ boardId });

export const cursorUpdateSchema = z.object({
  boardId,
  x: z.number().finite(),
  y: z.number().finite(),
  tool: z.string().max(32).optional(),
});

/** Same structural rules as the REST API — the socket is not a bypass. */
export const elementCreateSchema = z.object({
  boardId,
  element: elementDataSchema,
});

export const elementUpdateSchema = z.object({
  boardId,
  id: elementId,
  patch: updateElementSchema.shape.patch,
});

export const elementDeleteSchema = z.object({ boardId, id: elementId });

/** Ephemeral transform while dragging/resizing — never persisted. */
export const elementPreviewSchema = z.object({
  boardId,
  id: elementId,
  x: z.number().finite(),
  y: z.number().finite(),
  rotation: z.number().finite().optional(),
  scaleX: z.number().finite().optional(),
  scaleY: z.number().finite().optional(),
  /** true on the final frame so receivers can drop the transient state. */
  end: z.boolean().optional(),
});

export const commentCreateSchema = z.object({
  boardId,
  content: z.string().trim().min(1).max(2000),
  element_id: elementId.nullish(),
  x: z.number().finite().nullish(),
  y: z.number().finite().nullish(),
  clientId: z.string().min(1).max(64).nullish(),
});

export const commentDeleteSchema = z.object({
  boardId,
  id: z.coerce.number().int().positive(),
});

export default {
  joinBoardSchema,
  cursorUpdateSchema,
  elementCreateSchema,
  elementUpdateSchema,
  elementDeleteSchema,
  elementPreviewSchema,
  commentCreateSchema,
  commentDeleteSchema,
};
