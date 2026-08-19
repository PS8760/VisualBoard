import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../../src/utils/jwt.js';
import { hashPassword, comparePassword } from '../../src/utils/hash.js';
import { parseOrThrow } from '../../src/utils/params.js';
import AppError from '../../src/utils/errors.js';
import { z } from 'zod';
import { sanitizeFileName, makeStorageKey } from '../../src/modules/document/document.service.js';

describe('jwt', () => {
  const payload = { id: 1, email: 'a@b.c' };

  it('signs and verifies a token', () => {
    const token = signToken(payload);
    const decoded = verifyToken(token);
    expect(decoded).toMatchObject(payload);
    expect(decoded).not.toBeNull();
  });

  it('rejects a tampered token (returns null)', () => {
    const token = signToken(payload);
    const tampered = `${token.slice(0, -4)}abcd`;
    expect(verifyToken(tampered)).toBeNull();
  });

  it('rejects garbage input (returns null)', () => {
    expect(verifyToken('not-a-token')).toBeNull();
  });
});

describe('hash', () => {
  it('hashes and compares passwords', async () => {
    const hash = await hashPassword('Password123!');
    expect(hash).not.toContain('Password123!');
    await expect(comparePassword('Password123!', hash)).resolves.toBe(true);
    await expect(comparePassword('wrong', hash)).resolves.toBe(false);
  });
});

describe('parseOrThrow', () => {
  const schema = z.coerce.number().int().positive();

  it('parses valid numbers', () => {
    expect(parseOrThrow(schema, '12')).toBe(12);
    expect(parseOrThrow(schema, '1')).toBe(1);
  });

  it('throws a 422 AppError for non-numeric input', () => {
    try {
      parseOrThrow(schema, 'abc');
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(422);
      expect((e as AppError).code).toBe('VALIDATION_ERROR');
    }
  });

  it('throws for non-positive numbers', () => {
    expect(() => parseOrThrow(schema, '-1')).toThrow(AppError);
    expect(() => parseOrThrow(schema, '0')).toThrow(AppError);
  });
});

describe('document helpers', () => {
  it('sanitizes filenames', () => {
    expect(sanitizeFileName('my report.pdf')).toBe('my report.pdf');
    expect(sanitizeFileName('../../etc/passwd')).toBe('.etcpasswd');
    expect(sanitizeFileName('\u0000\u001fevil!.pdf')).toBe('evil.pdf');
    expect(sanitizeFileName('')).toBe('document');
    expect(sanitizeFileName('a'.repeat(300))).toHaveLength(180);
  });

  it('generates unique storage keys with a safe extension', () => {
    const a = makeStorageKey('file.pdf', 'application/pdf');
    const b = makeStorageKey('file.pdf', 'application/pdf');
    expect(a.endsWith('.pdf')).toBe(true);
    expect(b.endsWith('.pdf')).toBe(true);
    expect(a).not.toBe(b);
    expect(makeStorageKey('noext', 'text/plain').endsWith('.bin')).toBe(true);
    expect(makeStorageKey('x"../.pdf', 'application/pdf')).not.toContain('"');
  });
});