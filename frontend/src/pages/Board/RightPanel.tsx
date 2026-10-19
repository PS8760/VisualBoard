import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Info, MessageSquare, FileText, Sparkles, X, Loader2, Trash2,
} from 'lucide-react';
import { cn, formatFileSize, timeAgo } from '../../utils';
import { useBoardStore } from '../../stores/useBoardStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useUIStore } from '../../stores/useUIStore';
import SuggestionsPanel from './SuggestionsPanel';
import { useBoardSuggestions } from '../../hooks/useBoardSuggestions';
import { useAuthStore } from '../../stores/useAuthStore';
import type { PanelTab, BoardElement, CommentItem } from '../../types';

const TABS: Array<{ id: PanelTab; label: string; icon: typeof Info }> = [
  { id: 'info', label: 'Info', icon: Info },
  { id: 'comments', label: 'Comments', icon: MessageSquare },
  { id: 'documents', label: 'Docs', icon: FileText },
  { id: 'suggestions', label: 'Suggestions', icon: Sparkles },
];

export default function RightPanel() {
  const open = useUIStore((s) => s.rightPanelOpen);
  const tab = useUIStore((s) => s.rightPanelTab);
  const setTab = useUIStore((s) => s.setRightPanelTab);
  const setOpen = useUIStore((s) => s.setRightPanel);

  if (!open) return null;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="glass pointer-events-auto absolute bottom-[84px] right-3 top-[68px] z-30 flex w-[320px] flex-col overflow-hidden rounded-2xl"
      aria-label="Board panel"
      data-tour="panel"
    >
      <div className="flex items-center justify-between gap-1 overflow-hidden border-b border-line pl-2 pr-1.5">
        <div className="flex min-w-0" role="tablist" aria-label="Panel sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'relative flex h-10 shrink-0 items-center gap-1 px-2 text-[11.5px] font-medium transition-colors',
                tab === t.id ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {t.label}
              {t.id === 'suggestions' && <SuggestionBadge />}
              {tab === t.id && <span className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-accent" />}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
          aria-label="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'info' && <BoardInfo />}
        {tab === 'comments' && <CommentsPanel />}
        {tab === 'documents' && <DocumentsPanel />}
        {tab === 'suggestions' && <SuggestionsPanel />}
      </div>
    </motion.aside>
  );
}

/** Count of open local suggestions; red when something is critical. */
function SuggestionBadge() {
  const { visible } = useBoardSuggestions();
  if (!visible.length) return null;
  const critical = visible.some((s) => s.severity === 'high');
  return (
    <span
      className={cn(
        'min-w-[14px] rounded-full px-[3px] text-center font-mono text-[8.5px] leading-[14px]',
        critical ? 'bg-danger text-white' : 'bg-paper-3 text-ink-2',
      )}
      aria-label={`${visible.length} suggestions`}
    >
      {visible.length}
    </span>
  );
}

function BoardInfo() {
  const board = useBoardStore((s) => s.board);
  const selectedIds = useBoardStore((s) => s.selectedIds);

  const stats = board
    ? [
      ['Elements', board.elements.length],
      ['Connections', board.elements.filter((e) => e.kind === 'line' || e.kind === 'arrow').length],
      ['Attachments', board.elements.filter((e) => e.attachment).length],
      ['Members', board.members?.length ?? 0],
    ]
    : [];

  // Get selected elements for property editing
  const selectedElements = board?.elements.filter((e) => selectedIds.includes(e.id)) ?? [];

  return (
    <div className="space-y-5">
      <div>
        <p className="mono-label mb-2 text-ink-3">Board info</p>
        <div className="grid grid-cols-2 gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-md border border-line bg-paper px-3 py-2.5">
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-3">{label}</p>
              <p className="mt-1 text-[15px] font-semibold tabular-nums text-ink">{value}</p>
            </div>
          ))}
        </div>
        {board && (
          <dl className="mt-3 space-y-1.5 font-mono text-[10.5px] text-ink-3">
            <div className="flex justify-between"><dt>created</dt><dd className="text-ink-2">{timeAgo(board.createdAt)}</dd></div>
            <div className="flex justify-between"><dt>updated</dt><dd className="text-ink-2">{timeAgo(board.updatedAt)}</dd></div>
            <div className="flex justify-between"><dt>id</dt><dd className="truncate text-ink-2">{board.id.slice(0, 14)}</dd></div>
          </dl>
        )}
      </div>

      {selectedIds.length > 0 && selectedElements.length > 0 && (
        <ShapeInspector elements={selectedElements} />
      )}

      <div>
        <p className="mono-label mb-2 text-ink-3">Selection</p>
        {selectedIds.length ? (
          <div className="space-y-1.5">
            <p className="text-[12px] text-ink-2">
              {selectedIds.length} element{selectedIds.length > 1 ? 's' : ''} selected
            </p>
            <button
              onClick={() => useBoardStore.getState().removeElements(selectedIds)}
              className="h-7 w-full rounded-sm border border-danger/30 text-[11.5px] font-medium text-danger transition-colors hover:bg-danger-soft"
            >
              Delete selection
            </button>
          </div>
        ) : (
          <p className="text-[12px] leading-relaxed text-ink-3">
            Select an element on the canvas to inspect or delete it. Drag files onto an element to attach them.
          </p>
        )}
      </div>
    </div>
  );
}

interface ShapeInspectorProps {
  elements: BoardElement[];
}

function ShapeInspector({ elements }: ShapeInspectorProps) {
  const updateElement = useBoardStore((s) => s.updateElement);

  // Find common properties across selected elements
  const firstEl = elements[0];
  const canEditFill = elements.every((e) => ['rect', 'circle', 'sticky', 'document'].includes(e.kind));
  const canEditStroke = elements.every((e) => ['rect', 'circle', 'line', 'arrow', 'pen'].includes(e.kind));
  const canEditStrokeWidth = canEditStroke;
  const canEditFontSize = elements.every((e) => ['text', 'sticky', 'document'].includes(e.kind));
  const canEditOpacity = true;

  const commonFill = canEditFill && elements.every((e) => e.fill === firstEl.fill) ? firstEl.fill : '';
  const commonStroke = canEditStroke && elements.every((e) => e.stroke === firstEl.stroke) ? firstEl.stroke : '';
  const commonStrokeWidth = canEditStrokeWidth && elements.every((e) => e.strokeWidth === firstEl.strokeWidth) ? firstEl.strokeWidth : 1.5;
  const commonFontSize = canEditFontSize && elements.every((e) => e.fontSize === firstEl.fontSize) ? firstEl.fontSize : 14;

  // The canvas re-renders changed elements from the store, so edits made here
  // look identical locally and for collaborators (no direct fabric mutation).
  const handlePropertyChange = (property: keyof BoardElement, value: string | number) => {
    // The server caps color strings at 50 chars; longer input would be rejected.
    if ((property === 'fill' || property === 'stroke') && String(value).length > 50) return;
    elements.forEach((el) => updateElement(el.id, { [property]: value } as Partial<BoardElement>));
  };

  return (
    <div className="rounded-md border border-line-2 bg-paper p-3">
      <p className="mono-label mb-3 text-ink-3">Properties</p>
      <div className="space-y-3">
        {canEditFill && (
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-ink-3">
              Fill
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={commonFill || '#fafaf8'}
                onChange={(e) => handlePropertyChange('fill', e.target.value)}
                className="h-8 w-12 cursor-pointer rounded-sm border border-line-2"
              />
              <input
                type="text"
                value={commonFill || '#fafaf8'}
                onChange={(e) => handlePropertyChange('fill', e.target.value)}
                className="h-8 flex-1 rounded-sm border border-line-2 bg-paper px-2 font-mono text-[11px] text-ink focus:border-ink focus:outline-none"
                placeholder="Mixed"
              />
            </div>
          </div>
        )}

        {canEditStroke && (
          <div>
            <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-ink-3">
              Stroke
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={commonStroke || '#c2c0b5'}
                onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                className="h-8 w-12 cursor-pointer rounded-sm border border-line-2"
              />
              <input
                type="text"
                value={commonStroke || '#c2c0b5'}
                onChange={(e) => handlePropertyChange('stroke', e.target.value)}
                className="h-8 flex-1 rounded-sm border border-line-2 bg-paper px-2 font-mono text-[11px] text-ink focus:border-ink focus:outline-none"
                placeholder="Mixed"
              />
            </div>
          </div>
        )}

        {canEditStrokeWidth && (
          <div>
            <label className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-ink-3">
              <span>Stroke Width</span>
              <span className="text-ink-2">{commonStrokeWidth}px</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={commonStrokeWidth}
              onChange={(e) => handlePropertyChange('strokeWidth', parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-paper-2 outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
            />
          </div>
        )}

        {canEditFontSize && (
          <div>
            <label className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-ink-3">
              <span>Font Size</span>
              <span className="text-ink-2">{commonFontSize}px</span>
            </label>
            <input
              type="range"
              min="8"
              max="48"
              step="1"
              value={commonFontSize}
              onChange={(e) => handlePropertyChange('fontSize', parseInt(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-paper-2 outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
            />
          </div>
        )}

        {canEditOpacity && (
          <div>
            <label className="mb-1.5 flex items-center justify-between font-mono text-[10px] uppercase tracking-wide text-ink-3">
              <span>Opacity</span>
              <span className="text-ink-2">{Math.round((firstEl.opacity ?? 1) * 100)}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={firstEl.opacity ?? 1}
              onChange={(e) => handlePropertyChange('opacity', parseFloat(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-paper-2 outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ink"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CommentsPanel() {
  const comments = useBoardStore((s) => s.comments);
  const me = useAuthStore((s) => s.user?.id);
  const isOwner = useBoardStore((s) => s.board?.members.find((m) => m.id === me)?.role === 'owner');
  const [draft, setDraft] = useState('');

  const post = () => {
    if (!draft.trim()) return;
    useBoardStore.getState().addComment(draft.trim());
    setDraft('');
  };

  const focusThread = (c: CommentItem) => {
    if (c.x === undefined || c.y === undefined) return;
    const { container, canvas, viewport } = useCanvasStore.getState();
    if (canvas && container) {
      // Center the thread anchor in view at the current zoom.
      const s = viewport.scale;
      canvas.setViewportTransform([s, 0, 0, s, container.clientWidth / 2 - c.x * s, container.clientHeight / 2 - c.y * s]);
      canvas.requestRenderAll();
      useCanvasStore.getState().syncViewport();
    }
    useUIStore.getState().setActiveComment({ elementId: c.elementId, x: c.x, y: c.y });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2.5 overflow-y-auto">
        {comments.length === 0 && (
          <p className="py-8 text-center text-[12px] text-ink-3">
            No comments yet. Leave the first one.
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className={cn('group rounded-md border bg-paper p-2.5 shadow-xs', c.failed ? 'border-danger/40' : 'border-line')}>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-semibold text-white" style={{ background: c.author.color }}>
                {c.author.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="text-[11.5px] font-semibold text-ink">{c.author.name}</span>
              <span className="ml-auto font-mono text-[9.5px] text-ink-3">
                {c.pending ? <Loader2 size={10} className="animate-spin" /> : timeAgo(c.createdAt)}
              </span>
              {(c.author.id === me || isOwner || c.failed) && !c.pending && (
                <button
                  onClick={() => useBoardStore.getState().removeComment(c.id)}
                  className="hidden h-5 w-5 items-center justify-center rounded-sm text-ink-3 hover:bg-danger-soft hover:text-danger group-hover:flex"
                  aria-label="Delete comment"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-ink-2">
              {c.text || <span className="text-ink-3">—</span>}
            </p>
            {c.failed && <p className="mt-1 text-[10.5px] text-danger">Not posted — delete it and try again.</p>}
            {c.x !== undefined && c.y !== undefined && (
              <button
                onClick={() => focusThread(c)}
                className="mt-1 font-mono text-[9px] uppercase tracking-wide text-ink-3 hover:text-accent"
              >
                {c.elementId ? `pinned to ${c.elementId.replace('el_', '')}` : 'pinned on canvas'} · show
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2 border-t border-line pt-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && post()}
          maxLength={2000}
          placeholder="Write a comment…"
          className="h-8 flex-1 rounded-sm border border-line-2 bg-paper px-2.5 text-[12px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
          aria-label="New comment"
        />
        <button
          onClick={post}
          className="h-8 rounded-sm bg-ink px-3 text-[11.5px] font-medium text-paper transition-colors hover:bg-ink-hover"
        >
          Post
        </button>
      </div>
    </div>
  );
}

function DocumentsPanel() {
  const board = useBoardStore((s) => s.board);
  const setPreview = useUIStore((s) => s.setDocumentPreview);
  const attached = board?.elements.filter((e) => e.attachment) ?? [];

  if (!attached.length) {
    return (
      <div className="py-10 text-center">
        <FileText size={18} className="mx-auto mb-3 text-ink-3" />
        <p className="text-[12.5px] font-medium text-ink-2">No documents attached</p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
          Drag a file onto any element on the canvas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="mono-label text-ink-3">Attached files</p>
      {attached.map((el) => (
        <button
          key={el.attachment!.id}
          onClick={() => setPreview(el.attachment!)}
          className="flex w-full items-center gap-2.5 rounded-md border border-line bg-paper p-2.5 text-left shadow-xs transition-all duration-150 hover:border-line-3 hover:shadow-sm"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
            <FileText size={14} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] font-semibold text-ink">{el.attachment!.name}</span>
            <span className="block font-mono text-[9.5px] text-ink-3">
              {formatFileSize(el.attachment!.size)} · {timeAgo(el.attachment!.uploadedAt)}
            </span>
          </span>
          <span className="shrink-0 rounded-sm bg-paper-2 px-1.5 py-0.5 font-mono text-[9px] text-ink-3">
            on {el.content || el.id.slice(0, 6)}
          </span>
        </button>
      ))}
    </div>
  );
}
