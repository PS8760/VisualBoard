import { useMemo, useState } from 'react';
import { FileText, MessageSquare, Trash2, X, AlertCircle, Loader2 } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useUIStore } from '../../stores/useUIStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { formatFileSize, timeAgo } from '../../utils';
import { buildThreads, elementAnchor, threadKeyFor, type Thread } from '../../services/commentThreads';

/** Pins further than this outside the viewport are not rendered. */
const CULL_MARGIN = 80;

/**
 * DOM overlays for attachments and comment threads, positioned via the
 * world→screen transform on every viewport change. Kept outside Fabric so
 * hover/click UX and text input are native.
 */
export default function ElementOverlays() {
  const board = useBoardStore((s) => s.board);
  const comments = useBoardStore((s) => s.comments);
  const viewport = useCanvasStore((s) => s.viewport);
  const container = useCanvasStore((s) => s.container);
  const setPreview = useUIStore((s) => s.setDocumentPreview);
  const setActiveComment = useUIStore((s) => s.setActiveComment);
  const activeComment = useUIStore((s) => s.activeComment);

  const elements = board?.elements;
  const threads = useMemo(() => buildThreads(elements ?? [], comments), [elements, comments]);

  if (!board) return null;

  const { x: vx, y: vy, scale } = viewport;
  const toScreen = (x: number, y: number) => ({ x: x * scale + vx, y: y * scale + vy });
  const width = container?.clientWidth ?? Infinity;
  const height = container?.clientHeight ?? Infinity;
  const visible = (p: { x: number; y: number }) =>
    p.x > -CULL_MARGIN && p.y > -CULL_MARGIN && p.x < width + CULL_MARGIN && p.y < height + CULL_MARGIN;

  const attached = board.elements.filter((e) => e.attachment);

  // Resolve the open thread's live anchor (it follows a moving element).
  let active: { thread: Thread | null; x: number; y: number; elementId?: string } | null = null;
  if (activeComment) {
    const el = activeComment.elementId ? board.elements.find((e) => e.id === activeComment.elementId) : undefined;
    const anchor = el ? elementAnchor(el) : { x: activeComment.x, y: activeComment.y };
    const key = threadKeyFor({ elementId: el?.id, ...anchor }, new Set(el ? [el.id] : []));
    active = { thread: threads.find((t) => t.key === key) ?? null, ...anchor, elementId: el?.id };
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {attached.map((el) => {
        const pos = toScreen(el.x + (el.width * (el.scaleX ?? 1)) / 2, el.y);
        if (!visible(pos)) return null;
        return (
          <div
            key={`${el.id}:${el.attachment!.id}`}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full"
            style={{ left: pos.x, top: pos.y }}
          >
            <button
              onClick={() => setPreview(el.attachment!)}
              className="group flex items-center gap-1.5 rounded-md border border-line-2 bg-paper px-2 py-1 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-line-3 hover:shadow-md"
              title={`${el.attachment!.name} · ${formatFileSize(el.attachment!.size)} · ${timeAgo(el.attachment!.uploadedAt)}`}
              aria-label={`Preview ${el.attachment!.name}`}
            >
              <FileText size={11} className="text-accent" />
              <span className="max-w-[130px] truncate font-mono text-[10px] text-ink-2">{el.attachment!.name}</span>
            </button>
          </div>
        );
      })}

      {threads.map((t) => {
        const pos = toScreen(t.x, t.y);
        if (!visible(pos)) return null;
        const count = t.comments.length;
        const hasFailed = t.comments.some((c) => c.failed);
        return (
          <div
            key={t.key}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos.x, top: pos.y }}
          >
            <button
              onClick={() => setActiveComment({ elementId: t.elementId, x: t.x, y: t.y })}
              className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-paper bg-accent text-white shadow-md transition-transform duration-150 hover:scale-110"
              aria-label={`${count} comment${count > 1 ? 's' : ''} — open thread`}
            >
              {hasFailed ? <AlertCircle size={12} /> : <MessageSquare size={12} />}
              {count > 1 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ink px-1 text-[8.5px] font-semibold">
                  {count}
                </span>
              )}
            </button>
          </div>
        );
      })}

      {active && (
        <ThreadPopover
          key={`${active.elementId ?? ''}:${Math.round(active.x)},${Math.round(active.y)}`}
          position={toScreen(active.x, active.y)}
          thread={active.thread}
          elementId={active.elementId}
          anchor={{ x: active.x, y: active.y }}
          onClose={() => setActiveComment(null)}
        />
      )}
    </div>
  );
}

function ThreadPopover({
  position,
  thread,
  elementId,
  anchor,
  onClose,
}: {
  position: { x: number; y: number };
  thread: Thread | null;
  elementId?: string;
  anchor: { x: number; y: number };
  onClose: () => void;
}) {
  const [draft, setDraft] = useState('');
  const me = useAuthStore((s) => s.user?.id);
  const isOwner = useBoardStore((s) => s.board?.members.find((m) => m.id === me)?.role === 'owner');
  const comments = thread?.comments ?? [];

  const post = () => {
    const text = draft.trim();
    if (!text) return;
    useBoardStore.getState().addComment(text, { elementId, x: anchor.x, y: anchor.y });
    setDraft('');
  };

  return (
    <div
      className="pointer-events-none absolute z-30 -translate-x-1/2 translate-y-5"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="pointer-events-auto w-[260px] rounded-lg border border-line-2 bg-paper p-3 shadow-md"
        role="dialog"
        aria-label="Comment thread"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center justify-between">
          <p className="mono-label text-ink-3">{elementId ? 'Thread on element' : 'Comment thread'}</p>
          <button
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
            aria-label="Close thread"
          >
            <X size={12} />
          </button>
        </div>

        {comments.length > 0 && (
          <ul className="mb-2 max-h-48 space-y-2 overflow-y-auto">
            {comments.map((c) => (
              <li key={c.id} className="group rounded-md bg-paper-2/60 px-2 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.author.color }} />
                  <span className="truncate text-[11px] font-semibold text-ink">{c.author.name}</span>
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-ink-3">
                    {c.pending ? <Loader2 size={9} className="animate-spin" /> : timeAgo(c.createdAt)}
                  </span>
                  {(c.author.id === me || isOwner || c.failed) && !c.pending && (
                    <button
                      onClick={() => useBoardStore.getState().removeComment(c.id)}
                      className="hidden h-4 w-4 items-center justify-center text-ink-3 hover:text-danger group-hover:flex"
                      aria-label="Delete comment"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[11.5px] leading-relaxed text-ink-2">{c.text}</p>
                {c.failed && <p className="mt-0.5 text-[10px] text-danger">Not posted — delete and try again.</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-1.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                post();
              }
              if (e.key === 'Escape') onClose();
            }}
            maxLength={2000}
            placeholder={comments.length ? 'Reply…' : 'Write a comment…'}
            className="h-7 min-w-0 flex-1 rounded-sm border border-line-2 bg-paper px-2 text-[11.5px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
            aria-label="Comment text"
          />
          <button
            onClick={post}
            disabled={!draft.trim()}
            className="h-7 rounded-sm bg-ink px-2.5 text-[11px] font-medium text-paper transition-colors hover:bg-black disabled:opacity-40"
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
