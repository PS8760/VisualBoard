import { z } from 'zod';

export const suggestionsParamsSchema = z.object({
  boardId: z.coerce.number().int().positive(),
});

export const suggestionsBodySchema = z.object({
  prompt: z.string().trim().max(500, 'Prompt is too long').optional().nullable(),
});

export default { suggestionsParamsSchema, suggestionsBodySchema };