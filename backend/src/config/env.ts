import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)) });

/**
 * Validated environment configuration.
 *
 * Required variables fail fast in every environment so misconfiguration is
 * loud instead of silently producing a broken or insecure server.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z
    .string()
    .min(1, 'JWT_SECRET is required')
    .refine(
      (s) => s.length >= 32 || s === 'dev-only-insecure-secret-change-me',
      'JWT_SECRET must be at least 32 characters (or use the documented dev-only placeholder)',
    ),
  JWT_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  FRONTEND_ORIGIN: z
    .string()
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean))
    .refine((origins) => origins.length > 0 && origins.every((o) => z.string().url().safeParse(o).success), {
      message: 'FRONTEND_ORIGIN must be a comma-separated list of valid URLs',
    })
    .default(['http://localhost:5173']),

  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  /** Optional Groq API key enabling the AI suggestions endpoint. */
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('openai/gpt-oss-120b'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./uploads'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WRITE_MAX: z.coerce.number().int().positive().default(200),
});

export type Env = z.infer<typeof EnvSchema>;

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const missing = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('\n  - ');
  console.error(`[config] Invalid environment configuration:\n  - ${missing}`);
  process.exit(1);
}

export const env: Env = {
  ...parsed.data,
  S3_FORCE_PATH_STYLE: parsed.data.S3_FORCE_PATH_STYLE ?? undefined,
};

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
export const isDev = env.NODE_ENV === 'development';

/** Origin(s) the API trusts for CORS. */
export const corsOrigins = env.FRONTEND_ORIGIN;

/** OAuth providers that have client credentials configured. */
export const oauthConfigured = {
  github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
};

/** Whether the AI suggestions endpoint is available. */
export const suggestionsConfigured = Boolean(env.GROQ_API_KEY);

export default env;
