/**
 * Runs once in the worker process BEFORE any test file imports app code,
 * so config/env.ts and prisma.ts bind to the test database.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-only-secret-that-is-longer-than-thirty-two-chars';
process.env.STORAGE_LOCAL_DIR = process.env.STORAGE_LOCAL_DIR ?? '/tmp/vb-test-uploads';
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5174';
process.env.LOG_LEVEL = 'silent';

export {}