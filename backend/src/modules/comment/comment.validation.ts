import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000, 'Comment is too long'),
  element_id: z.string().max(64).nullish(),
  x: z.number().finite().nullish(),
  y: z.number().finite().nullish(),
});

export const updateCommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
});

export const commentIdParamSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  commentId: z.coerce.number().int().positive(),
});

export const boardIdParamSchema = z.object({
  boardId: z.coerce.number().int().positive(),
});

export default { createCommentSchema, updateCommentSchema, commentIdParamSchema, boardIdParamSchema };