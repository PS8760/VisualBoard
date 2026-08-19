import { describe, expect, it } from 'vitest';
import { elementDataSchema, bulkSyncSchema } from '../../src/modules/element/element.validation.js';

const validElement = {
  id: 'el_1',
  kind: 'rect' as const,
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  rotation: 0,
  fill: '#r1',
  stroke: '#r2',
  strokeWidth: 2,
  content: 'hello',
  version: 1,
};

describe('elementDataSchema', () => {
  it('accepts a valid fabric wire-format element', () => {
    expect(elementDataSchema.safeParse(validElement).success).toBe(true);
  });

  it('rejects an unknown kind', () => {
    const bad = { ...validElement, kind: 'octagon' };
    expect(elementDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a missing kind', () => {
    const { kind: _kind, ...rest } = validElement;
    expect(elementDataSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-finite coordinates', () => {
    const bad = { ...validElement, x: Number.NaN };
    expect(elementDataSchema.safeParse(bad).success).toBe(false);
    const badY = { ...validElement, y: Number.POSITIVE_INFINITY };
    expect(elementDataSchema.safeParse(badY).success).toBe(false);
  });

  it('rejects negative width', () => {
    const bad = { ...validElement, width: -10 };
    expect(elementDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects strokeWidth over 200', () => {
    const bad = { ...validElement, strokeWidth: 201 };
    expect(elementDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects content over 100k chars', () => {
    const bad = { ...validElement, content: 'a'.repeat(100_001) };
    expect(elementDataSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a payload over the 200KB wire limit', () => {
    const bad = { ...validElement, content: 'a'.repeat(150_000), unusedField: 'x'.repeat(60_000) };
    expect(elementDataSchema.safeParse(bad).success).toBe(false);
  });

  it('passes through unknown extra fields (fabric extensions)', () => {
    const extra = { ...validElement, someFabricProp: { nested: [1, 2] } };
    const result = elementDataSchema.safeParse(extra);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.someFabricProp).toEqual({ nested: [1, 2] });
    }
  });
});

describe('bulkSyncSchema', () => {
  it('accepts up to 5000 elements', () => {
    const elements = Array.from({ length: 5000 }, (_, i) => ({ ...validElement, id: `el_${i}` }));
    expect(bulkSyncSchema.safeParse({ elements }).success).toBe(true);
  });

  it('rejects more than 5000 elements', () => {
    const elements = Array.from({ length: 5001 }, (_, i) => ({ ...validElement, id: `el_${i}` }));
    expect(bulkSyncSchema.safeParse({ elements }).success).toBe(false);
  });
});