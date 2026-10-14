import type { BoardElement, CommentItem } from '../types';

export interface Thread {
  key: string;
  elementId?: string;
  /** World-space anchor. */
  x: number;
  y: number;
  comments: CommentItem[];
}

/** Where an element's thread pin sits: its top-right corner, in world space. */
export function elementAnchor(el: BoardElement) {
  return { x: el.x + el.width * (el.scaleX ?? 1), y: el.y };
}

export function threadKeyFor(c: Pick<CommentItem, 'elementId' | 'x' | 'y'>, elementIds: Set<string>): string | null {
  if (c.elementId && elementIds.has(c.elementId)) return `el:${c.elementId}`;
  if (typeof c.x === 'number' && typeof c.y === 'number') return `pt:${Math.round(c.x)},${Math.round(c.y)}`;
  return null;
}

/**
 * Groups comments into canvas threads. Element threads follow their element;
 * free threads (and threads whose element was deleted) stay on their absolute
 * world point. Comments with no anchor are board-level and live in the panel.
 */
export function buildThreads(elements: BoardElement[], comments: CommentItem[]): Thread[] {
  const byId = new Map(elements.map((el) => [el.id, el] as const));
  const ids = new Set(byId.keys());
  const threads = new Map<string, Thread>();
  for (const c of comments) {
    const key = threadKeyFor(c, ids);
    if (!key) continue;
    let thread = threads.get(key);
    if (!thread) {
      const el = c.elementId ? byId.get(c.elementId) : undefined;
      const anchor = el ? elementAnchor(el) : { x: c.x!, y: c.y! };
      thread = { key, elementId: el?.id, ...anchor, comments: [] };
      threads.set(key, thread);
    }
    thread.comments.push(c);
  }
  return [...threads.values()];
}
