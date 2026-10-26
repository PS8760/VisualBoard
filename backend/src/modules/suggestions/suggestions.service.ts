import prisma from '../../config/prisma.js';
import { env, suggestionsConfigured } from '../../config/env.js';
import { AppError, unavailableError, upstreamError, badRequestError } from '../../utils/errors.js';

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const SUGGESTION_TIMEOUT_MS = 25000;

interface BoardContext {
  title: string;
  description: string | null;
  elements: { kind: string; content: string }[];
  /** Connections between labelled shapes, e.g. "Web App → API". */
  links?: string[];
  comments: { author: string; content: string }[];
  memberCount: number;
}

export async function loadBoardContext(boardId: number): Promise<BoardContext> {
  const board = await prisma.boards.findUnique({
    where: { id: boardId },
    include: {
      elements: { take: 80, orderBy: { created_at: 'asc' } },
      comments: {
        take: 20,
        orderBy: { created_at: 'desc' },
        include: { users: { select: { name: true } } },
      },
      board_members: true,
    },
  });

  if (!board) {
    throw new AppError(404, 'NOT_FOUND', 'Board not found');
  }

  const rows = board.elements.map((el) => (el.element_data ?? {}) as Record<string, unknown>);
  const labelById = new Map<string, string>();
  for (const d of rows) {
    const label = typeof d.content === 'string' ? d.content.trim() : '';
    if (typeof d.id === 'string' && label) labelById.set(d.id, label.slice(0, 60));
  }
  const endOf = (b: unknown) =>
    b && typeof b === 'object' && typeof (b as { elementId?: unknown }).elementId === 'string'
      ? labelById.get((b as { elementId: string }).elementId)
      : undefined;
  const links: string[] = [];
  for (const d of rows) {
    if (d.kind !== 'arrow' && d.kind !== 'line') continue;
    const from = endOf(d.startBinding);
    const to = endOf(d.endBinding);
    if (from && to) links.push(`${from} ${d.kind === 'arrow' ? '→' : '—'} ${to}${typeof d.label === 'string' && d.label ? ` (${d.label.slice(0, 40)})` : ''}`);
  }

  return {
    title: board.title,
    description: board.description,
    elements: rows
      .filter((d) => d.kind !== 'arrow' && d.kind !== 'line')
      .map((d) => {
        const kind = typeof d.kind === 'string' ? d.kind : 'unknown';
        const content = typeof d.content === 'string' ? d.content : d.label ?? '';
        return { kind, content: String(content ?? '').slice(0, 120) };
      }),
    links: links.slice(0, 80),
    comments: board.comments.map((c) => ({
      author: c.users?.name ?? 'Unknown',
      content: String(c.content ?? '').slice(0, 200),
    })),
    memberCount: board.board_members.length,
  };
}

const buildMessages = (ctx: BoardContext, userPrompt: string | null) => {
  const elementLines = ctx.elements
    .map((el, i) => `${i + 1}. [${el.kind}] ${el.content || '(no label)'}`)
    .join('\n');
  const commentLines =
    ctx.comments.map((c) => `- ${c.author}: ${c.content}`).join('\n') || '(no comments yet)';

  const system = [
    'You are an expert software/architecture reviewer inside a collaborative whiteboard tool.',
    'You receive a board with sticky notes, cards and comments describing a software system or plan.',
    'Identify concrete, actionable improvements: missing components, risks, security gaps, scale concerns, or process suggestions.',
    'Ground every suggestion in what is actually on the board: refer to components by their exact labels and use the listed connections.',
    'Do not repeat generic advice that the board already covers.',
    'Respond with ONLY valid JSON matching this shape (no markdown, no commentary):',
    '{"suggestions":[{"title":"short headline","detail":"1-2 sentence explanation","category":"architecture|security|performance|reliability|process|product","priority":"high|medium|low","elements":["exact label of each board element involved"]}]}',
    'Return 2 to 5 suggestions, most important first. Keep titles under 60 chars and details under 200 chars.',
  ].join('\n');

  const user = [
    `Board title: ${ctx.title}`,
    ctx.description ? `Description: ${ctx.description}` : null,
    `Members: ${ctx.memberCount}`,
    `Elements:\n${elementLines || '(empty board)'}`,
    `Connections:\n${ctx.links?.length ? ctx.links.map((l) => `- ${l}`).join('\n') : '(none drawn)'}`,
    `Recent comments:\n${commentLines}`,
    userPrompt ? `Extra focus from the user: ${userPrompt}` : null,
    'Analyse the board and return the JSON suggestion list.',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ];
};

export interface ParsedSuggestion {
  title: string;
  detail: string;
  category: string;
  priority: string;
  /** Board labels the suggestion refers to. */
  elements: string[];
}

export const SUGGESTION_CATEGORIES = ['architecture', 'security', 'performance', 'reliability', 'process', 'product'];

export function parseSuggestionJson(raw: unknown): ParsedSuggestion[] {
  if (typeof raw !== 'string') throw badRequestError('AI response was not JSON');
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw badRequestError('AI response contained invalid JSON');
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { suggestions?: unknown }).suggestions)
  ) {
    throw badRequestError('AI response missing "suggestions" array');
  }

  const out: ParsedSuggestion[] = [];
  for (const item of (parsed as { suggestions: unknown[] }).suggestions.slice(0, 6)) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (typeof s.title !== 'string' || !s.title.trim()) continue;
    out.push({
      title: s.title.trim().slice(0, 80),
      detail: typeof s.detail === 'string' ? s.detail.trim().slice(0, 300) : '',
      category: SUGGESTION_CATEGORIES.includes(String(s.category)) ? String(s.category) : 'architecture',
      priority: ['high', 'medium', 'low'].includes(String(s.priority)) ? String(s.priority) : 'medium',
      elements: Array.isArray(s.elements)
        ? s.elements.filter((e): e is string => typeof e === 'string' && !!e.trim()).map((e) => e.trim().slice(0, 80)).slice(0, 6)
        : [],
    });
  }
  return out;
}

export async function requestGroqSuggestions(
  ctx: BoardContext,
  userPrompt: string | null,
): Promise<ParsedSuggestion[]> {
  if (!suggestionsConfigured || !env.GROQ_API_KEY) {
    throw unavailableError('AI suggestions are not configured on this server');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUGGESTION_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        temperature: 0.5,
        max_tokens: 1200,
        messages: buildMessages(ctx, userPrompt),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AppError(
        502,
        'UPSTREAM_ERROR',
        `The AI service returned ${res.status}${body ? `: ${body.slice(0, 160)}` : ''}`,
      );
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new AppError(502, 'UPSTREAM_ERROR', 'The AI service returned an empty response');

    return parseSuggestionJson(content);
  } catch (e) {
    if (e instanceof AppError) throw e;
    if (e instanceof Error && e.name === 'AbortError') {
      throw upstreamError('The AI service timed out');
    }
    throw upstreamError('The AI service is unreachable');
  } finally {
    clearTimeout(timer);
  }
}

export default { loadBoardContext, requestGroqSuggestions, parseSuggestionJson };
