import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  parseSuggestionJson,
  requestGroqSuggestions,
  loadBoardContext,
} from '../../src/modules/suggestions/suggestions.service.js';

const envShape = (overrides: Record<string, unknown> = {}) => {
  const env = {
    DATABASE_URL: process.env.DATABASE_URL_TEST ?? 'postgresql://postgres:postgres@localhost:5432/visualboard_test',
    JWT_SECRET: process.env.JWT_SECRET ?? 'dev-only-insecure-secret-change-me',
    GROQ_API_KEY: 'test-key',
    GROQ_MODEL: 'openai/gpt-oss-120b',
    FRONTEND_ORIGIN: ['http://localhost:5173'],
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
    ...overrides,
  };
  return {
    env,
    isProd: false,
    isTest: true,
    isDev: false,
    corsOrigins: ['http://localhost:5173'],
    oauthConfigured: { github: false, google: false },
    suggestionsConfigured: Boolean(env.GROQ_API_KEY),
    default: {},
  };
};

describe('suggestions service', () => {
  describe('parseSuggestionJson', () => {
    it('parses a clean JSON object', () => {
      const out = parseSuggestionJson(
        '{"suggestions":[{"title":"Add cache","detail":"Hit Redis","category":"performance","priority":"high"}]}',
      );
      expect(out).toEqual([
        { title: 'Add cache', detail: 'Hit Redis', category: 'performance', priority: 'high', elements: [] },
      ]);
    });

    it('keeps the board labels a suggestion refers to', () => {
      const out = parseSuggestionJson(
        '{"suggestions":[{"title":"Cache reads","category":"reliability","elements":["Orders API", 3, "", "Postgres"]}]}',
      );
      expect(out[0].elements).toEqual(['Orders API', 'Postgres']);
      expect(out[0].category).toBe('reliability');
    });

    it('strips markdown code fences', () => {
      const out = parseSuggestionJson('```json\n{"suggestions":[{"title":"T","detail":"D"}]}\n```');
      expect(out).toHaveLength(1);
      expect(out[0].title).toBe('T');
      expect(out[0].category).toBe('architecture');
      expect(out[0].priority).toBe('medium');
    });

    it('coerces unknown categories and priorities to defaults', () => {
      const out = parseSuggestionJson(
        '{"suggestions":[{"title":"T","detail":"D","category":"banana","priority":"ultra"}]}',
      );
      expect(out[0].category).toBe('architecture');
      expect(out[0].priority).toBe('medium');
    });

    it('drops invalid entries and caps the result list', () => {
      const items = Array.from({ length: 12 }, (_, i) => ({
        title: `Title ${i}`,
        detail: 'd',
      }));
      const out = parseSuggestionJson(JSON.stringify({ suggestions: [...items, { detail: 'no title' }] }));
      expect(out).toHaveLength(6);
    });

    it('rejects non-JSON and missing shapes', () => {
      expect(() => parseSuggestionJson('not json')).toThrow();
      expect(() => parseSuggestionJson('{"foo":1}')).toThrow();
    });
  });

  describe('requestGroqSuggestions', () => {
    const ctx: Awaited<ReturnType<typeof loadBoardContext>> = {
      title: 'Test board',
      description: null,
      elements: [{ kind: 'sticky', content: 'api' }],
      comments: [],
      memberCount: 1,
    };

    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('returns 503-style error when GROQ is not configured', async () => {
      vi.doMock('../../src/config/env.js', () => envShape({ GROQ_API_KEY: undefined }));
      const mod = await import('../../src/modules/suggestions/suggestions.service.js');
      const err = await mod.requestGroqSuggestions(ctx, null).catch((e: Error & { status?: number; code?: string }) => e);
      expect(err.status).toBe(503);
      expect(err.code).toBe('SERVICE_UNAVAILABLE');
    });

    it('calls Groq chat completions and returns parsed suggestions', async () => {
      vi.doMock('../../src/config/env.js', () => envShape());
      const fetchMock = vi.fn(async () => ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content:
                  '{"suggestions":[{"title":"Add auth","detail":"Wrap the API","category":"security","priority":"high"}]}',
              },
            },
          ],
        }),
      }));
      vi.stubGlobal('fetch', fetchMock);

      const mod = await import('../../src/modules/suggestions/suggestions.service.js');
      const out = await mod.requestGroqSuggestions(ctx, 'focus on auth');
      expect(out).toHaveLength(1);
      expect(out[0].title).toBe('Add auth');
      expect(out[0].category).toBe('security');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
      expect(options.headers.Authorization).toBe('Bearer test-key');
      expect(options.headers['Content-Type']).toBe('application/json');
    });

    it('surfaces upstream errors typed as UPSTREAM_ERROR', async () => {
      vi.doMock('../../src/config/env.js', () => envShape());
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429, text: async () => 'rate limited' })));
      const mod = await import('../../src/modules/suggestions/suggestions.service.js');
      const err = await mod.requestGroqSuggestions(ctx, null).catch((e: Error & { status?: number; code?: string }) => e);
      expect(err.status).toBe(502);
      expect(err.code).toBe('UPSTREAM_ERROR');
    });
  });
});