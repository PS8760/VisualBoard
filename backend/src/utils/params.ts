import { z } from 'zod';
import { validationError } from './errors.js';

/** Parses input against a schema, throwing a validation error with issues on failure. */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw validationError(result.error.issues);
  return result.data;
}

/** Parses input, returning a partially-typed object on failure instead of throwing. */
export function maybeParse<T extends z.ZodTypeAny>(schema: T, input: unknown): Partial<z.infer<T>> {
  const result = schema.safeParse(input);
  if (!result.success) return {};
  return result.data;
}

export default { parseOrThrow, maybeParse };