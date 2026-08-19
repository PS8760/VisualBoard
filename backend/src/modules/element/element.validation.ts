import { z } from 'zod';

const MAX_ELEMENT_JSON = 200_000; // ~200KB governs wire size of a single element
const MAX_ELEMENTS_PER_BULK = 5000;

const elementKind = z.enum(['rect', 'circle', 'sticky', 'line', 'arrow', 'pen', 'text', 'image', 'document', 'comment']);

const attachmentSchema = z.object({
  fileName: z.string().max(255).optional(),
  url: z.string().max(500).optional(),
  size: z.number().int().nonnegative().optional(),
}).passthrough().nullable().optional();

/** Structural validation of the fabric BoardElement wire format. */
const elementDataBase = z
  .object({
    id: z.string().max(64).optional(),
    kind: elementKind,
    x: z.number().finite().optional(),
    y: z.number().finite().optional(),
    width: z.number().finite().nonnegative().optional(),
    height: z.number().finite().nonnegative().optional(),
    rotation: z.number().finite().optional(),
    fill: z.string().max(50).optional(),
    stroke: z.string().max(50).optional(),
    strokeWidth: z.number().finite().nonnegative().max(200).optional(),
    content: z.string().max(100_000).optional(),
    points: z.array(z.number().finite()).max(20_000).optional(),
    pointsToPath: z.string().max(200_000).optional(),
    fontSize: z.number().finite().positive().optional(),
    radius: z.number().finite().nonnegative().optional(),
    commentCount: z.number().int().nonnegative().optional(),
    attachment: attachmentSchema,
    version: z.number().int().nonnegative().optional(),
  })
  .catchall(z.unknown());

export const elementDataSchema = elementDataBase.refine(
  (val) => JSON.stringify(val).length <= MAX_ELEMENT_JSON,
  { message: `Element payload exceeds the ${MAX_ELEMENT_JSON} byte limit` },
) as z.ZodType<Record<string, unknown>>;

export const elementIdParamSchema = z.object({
  boardId: z.coerce.number().int().positive(),
  elementId: z.string().min(1).max(64),
});

export const boardIdParamSchema = z.object({
  boardId: z.coerce.number().int().positive(),
});

export const createElementSchema = z.object({
  element: elementDataSchema,
});

export const updateElementSchema = z.object({
  patch: elementDataBase
    .partial()
    .refine((patch) => Object.keys(patch).length <= 64, 'Too many fields in patch')
    .refine(
      (patch) => JSON.stringify(patch).length <= MAX_ELEMENT_JSON,
      `Patch payload exceeds the ${MAX_ELEMENT_JSON} byte limit`,
    ),
});

export const bulkSyncSchema = z.object({
  elements: z.array(elementDataSchema).max(MAX_ELEMENTS_PER_BULK, 'Bulk payload exceeds element limit'),
});

export default { elementDataSchema, createElementSchema, updateElementSchema, bulkSyncSchema, elementIdParamSchema, boardIdParamSchema };