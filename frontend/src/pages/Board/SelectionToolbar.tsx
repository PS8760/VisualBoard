import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BringToFront, SendToBack, Copy, Lock, Unlock, MessageSquarePlus, Trash2, Type, Palette, Minus, Spline,
  CornerDownRight, ArrowLeftRight, Activity, RotateCcw, Slash,
} from 'lucide-react';
import { useBoardStore } from '../../stores/useBoardStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { useUIStore } from '../../stores/useUIStore';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../utils';
import { themeInk } from '../../services/fabric.elements';
import { MARKERS, readConnector, type Marker } from '../../services/connectors/model';
import { drawMarker } from '../../services/connectors/draw';
import type { BoardElement } from '../../types';

const FILLS = [
  { name: 'Paper', value: '#fafaf8' },
  { name: 'Sun', value: '#fdeeb0' },
  { name: 'Peach', value: '#ffe4d1' },
  { name: 'Rose', value: '#fde2e1' },
  { name: 'Mint', value: '#dcf5e3' },
  { name: 'Sky', value: '#dbeafe' },
  { name: 'Lilac', value: '#ede4ff' },
  { name: 'Stone', value: '#e7e5df' },
  { name: 'None', value: 'transparent' },
];
const STROKES = [
  { name: 'Ink', value: '#1b1a17' },
  { name: 'Graphite', value: '#a8a69c' },
  { name: 'Vermilion', value: '#e8590c' },
  { name: 'Red', value: '#dc2626' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Violet', value: '#7c3aed' },
];
const WIDTHS = [1.5, 3, 5];
const STYLES: Array<{ value: NonNullable<BoardElement['strokeStyle']>; dash: string }> = [
  { value: 'solid', dash: '' },
  { value: 'dashed', dash: '6 4' },
  { value: 'dotted', dash: '1 4' },
];
const SIZES = [
  { label: 'S', value: 12 },
  { label: 'M', value: 15 },
  { label: 'L', value: 20 },
  { label: 'XL', value: 28 },
];

const ROUTINGS = [
  { value: 'straight' as const, label: 'Straight', icon: Slash },
  { value: 'curved' as const, label: 'Curved', icon: Spline },
  { value: 'elbow' as const, label: 'Elbow (orthogonal)', icon: CornerDownRight },
];

const MARKER_LABEL: Record<Marker, string> = {
  none: 'None',
  arrow: 'Arrow',
  stealth: 'Stealth',
  triangle: 'Triangle',
  'triangle-open': 'Open triangle',
  circle: 'Circle',
  diamond: 'Diamond',
  bar: 'Bar',
};

/** Tiny live preview of an end marker on a short line. */
function MarkerGlyph({ marker, flip = false }: { marker: Marker; flip?: boolean }) {
  const ref = (node: HTMLCanvasElement | null) => {
    if (!node) return;
    const dpr = window.devicePixelRatio || 1;
    node.width = 28 * dpr;
    node.height = 14 * dpr;
    const ctx = node.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 28, 14);
    const color = getComputedStyle(node).color || '#888';
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--color-paper').trim() || '#fff';
    ctx.save();
    if (flip) {
      ctx.translate(28, 0);
      ctx.scale(-1, 1);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(2, 7);
    ctx.lineTo(marker === 'none' ? 26 : 20, 7);
    ctx.stroke();
    drawMarker(ctx, marker, { x: 25, y: 7 }, { x: 1, y: 0 }, 9, color, paper, 1.5);
    ctx.restore();
  };
  return <canvas ref={ref} style={{ width: 28, height: 14 }} aria-hidden="true" />;
}

const FILLABLE = new Set(['rect', 'circle', 'sticky', 'document']);
const STROKABLE = new Set(['rect', 'circle', 'line', 'arrow', 'pen']);
const TEXTUAL = new Set(['text', 'sticky', 'rect', 'circle']);

type Popover = 'color' | 'stroke' | 'size' | 'startMarker' | 'endMarker' | null;

function Swatch({ color, active, onClick, label }: { color: string; active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
    >
      <span
        className={cn(
          'h-5 w-5 rounded-full border border-line-3',
          active && 'ring-2 ring-accent ring-offset-2 ring-offset-paper',
          color === 'transparent' && 'bg-[linear-gradient(135deg,transparent_45%,#dc2626_45%,#dc2626_55%,transparent_55%)]',
        )}
        style={color === 'transparent' ? undefined : { background: themeInk(color) }}
      />
    </button>
  );
}

function IconAction({ label, shortcut, onClick, children, danger, active }: {
  label: string;
  shortcut?: string[];
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  active?: boolean;
}) {
  return (
    <Tooltip label={label} shortcut={shortcut} side="top">
      <button
        onClick={onClick}
        aria-label={label}
        className={cn('island-btn h-8 w-8', danger && 'hover:bg-danger-soft hover:text-danger', active && 'bg-paper-3 text-ink')}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/**
 * Context-aware quick actions floating above the selection. Adapts to what's
 * selected (fill only for shapes, stroke for lines/ink, size for text) and
 * stays glued to the selection while panning/zooming; hidden mid-drag.
 */
export default function SelectionToolbar() {
  const selectedIds = useBoardStore((s) => s.selectedIds);
  const elements = useBoardStore((s) => s.board?.elements);
  const canEdit = useBoardStore((s) => s.canEdit || s.isDemo);
  const viewport = useCanvasStore((s) => s.viewport);
  const interacting = useCanvasStore((s) => s.interacting);
  const canvas = useCanvasStore((s) => s.canvas);
  const container = useCanvasStore((s) => s.container);
  const tool = useToolStore((s) => s.tool);
  const zen = useUIStore((s) => s.zen);
  // Popover state is keyed to the selection, so it resets when the selection changes.
  const selectionKey = selectedIds.join(',');
  const [popoverState, setPopoverState] = useState<{ key: string; open: Popover }>({ key: '', open: null });
  const popover = popoverState.key === selectionKey ? popoverState.open : null;
  const setPopover = (fn: (cur: Popover) => Popover) => setPopoverState({ key: selectionKey, open: fn(popover) });

  const selection = (elements ?? []).filter((el) => selectedIds.includes(el.id));

  const active = canvas?.getActiveObject();
  const editingText = !!active && 'isEditing' in active && (active as { isEditing?: boolean }).isEditing;
  if (!selection.length || !canEdit || interacting || tool !== 'select' || zen || !active || editingText) return null;

  const b = active.getBoundingRect();
  const { x: vx, y: vy, scale } = viewport;
  const width = container?.clientWidth ?? 1200;
  const left = Math.min(Math.max((b.left + b.width / 2) * scale + vx, 220), width - 220);
  const topAbove = b.top * scale + vy - 60;
  const placedBelow = topAbove < 70;
  const top = placedBelow ? (b.top + b.height) * scale + vy + 16 : topAbove;

  const kinds = new Set(selection.map((el) => el.kind));
  const ids = selection.map((el) => el.id);
  const first = selection[0]!;
  const canFill = [...kinds].some((k) => FILLABLE.has(k));
  const canStroke = [...kinds].some((k) => STROKABLE.has(k));
  const canSize = [...kinds].every((k) => TEXTUAL.has(k));
  const allLocked = selection.every((el) => el.locked);
  const single = selection.length === 1;
  const labelled = single && (first.kind === 'rect' || first.kind === 'circle');
  const allConnectors = selection.every((el) => el.kind === 'arrow' || el.kind === 'line');
  const conn = readConnector(first);

  const store = useBoardStore.getState();
  const apply = (patch: Partial<BoardElement>, onlyKinds?: Set<string>) => {
    store.commitHistory();
    selection.forEach((el) => {
      if (!onlyKinds || onlyKinds.has(el.kind)) store.updateElement(el.id, patch);
    });
    store.commitHistory();
  };

  const toggle = (p: Popover) => setPopover((cur) => (cur === p ? null : p));

  return (
    <AnimatePresence>
      <motion.div
        key="selection-toolbar"
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.14 }}
        className="pointer-events-auto absolute z-30 -translate-x-1/2"
        style={{ left, top }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && setPopover(() => null)}
        data-testid="selection-toolbar"
      >
        <div className="glass flex items-center gap-0.5 rounded-xl p-1" role="toolbar" aria-label="Selection actions">
          {(canFill || canStroke) && (
            <Tooltip label="Color" side="top">
              <button
                onClick={() => toggle('color')}
                aria-label="Color"
                aria-expanded={popover === 'color'}
                className={cn('island-btn h-8 w-8', popover === 'color' && 'bg-paper-3')}
              >
                {canFill ? (
                  <span
                    className="h-[18px] w-[18px] rounded-full border-2"
                    style={{ background: first.fill === 'transparent' ? 'transparent' : first.fill, borderColor: first.stroke }}
                  />
                ) : (
                  <Palette size={15} style={{ color: first.stroke }} />
                )}
              </button>
            </Tooltip>
          )}
          {canStroke && (
            <Tooltip label="Stroke" side="top">
              <button
                onClick={() => toggle('stroke')}
                aria-label="Stroke"
                aria-expanded={popover === 'stroke'}
                className={cn('island-btn h-8 w-8', popover === 'stroke' && 'bg-paper-3')}
              >
                <Minus size={16} strokeWidth={Math.min(4, (first.strokeWidth ?? 1.5) + 0.8)} />
              </button>
            </Tooltip>
          )}
          {canSize && (
            <Tooltip label="Text size" side="top">
              <button
                onClick={() => toggle('size')}
                aria-label="Text size"
                aria-expanded={popover === 'size'}
                className={cn('island-btn h-8 min-w-8 px-1.5 font-mono text-[11px] font-semibold', popover === 'size' && 'bg-paper-3')}
              >
                {SIZES.find((sz) => sz.value === first.fontSize)?.label ?? 'Aa'}
              </button>
            </Tooltip>
          )}
          {allConnectors && (
            <>
              <span className="mx-0.5 h-5 w-px bg-line-2" aria-hidden="true" />
              <div className="flex rounded-[0.6rem] bg-paper-2 p-0.5" role="radiogroup" aria-label="Routing">
                {ROUTINGS.map((r) => (
                  <Tooltip key={r.value} label={r.label} side="top">
                    <button
                      role="radio"
                      aria-checked={conn.routing === r.value}
                      aria-label={r.label}
                      onClick={() => {
                        apply({ routing: r.value, ...(r.value === 'elbow' ? { waypoints: [], bend: 0 } : {}) });
                        useToolStore.getState().setConnectorRouting(r.value);
                      }}
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-[0.5rem] transition-colors',
                        conn.routing === r.value ? 'bg-paper text-ink shadow-xs' : 'text-ink-3 hover:text-ink',
                      )}
                    >
                      <r.icon size={14} />
                    </button>
                  </Tooltip>
                ))}
              </div>
              <Tooltip label="Start marker" side="top">
                <button onClick={() => toggle('startMarker')} aria-label="Start marker" aria-expanded={popover === 'startMarker'} className={cn('island-btn h-8 w-9', popover === 'startMarker' && 'bg-paper-3')}>
                  <MarkerGlyph marker={conn.startMarker} flip />
                </button>
              </Tooltip>
              <Tooltip label="Swap direction" side="top">
                <button
                  onClick={() => apply({ startMarker: conn.endMarker, endMarker: conn.startMarker })}
                  aria-label="Swap direction"
                  className="island-btn h-8 w-6"
                >
                  <ArrowLeftRight size={12} />
                </button>
              </Tooltip>
              <Tooltip label="End marker" side="top">
                <button onClick={() => toggle('endMarker')} aria-label="End marker" aria-expanded={popover === 'endMarker'} className={cn('island-btn h-8 w-9', popover === 'endMarker' && 'bg-paper-3')}>
                  <MarkerGlyph marker={conn.endMarker} />
                </button>
              </Tooltip>
              <IconAction label={conn.animated ? 'Stop flow animation' : 'Animate flow'} active={conn.animated} onClick={() => apply({ animated: !conn.animated })}>
                <Activity size={15} />
              </IconAction>
              {single && (
                <IconAction label={conn.label ? 'Edit label' : 'Add label'} shortcut={['↵']} onClick={() => window.dispatchEvent(new Event('vb:edit-label'))}>
                  <Type size={15} />
                </IconAction>
              )}
              {single && (conn.waypoints.length > 0 || conn.bend !== 0) && (
                <IconAction label="Reset path" onClick={() => apply({ waypoints: [], bend: 0 })}>
                  <RotateCcw size={15} />
                </IconAction>
              )}
            </>
          )}
          {labelled && (
            <IconAction label="Edit label" shortcut={['↵']} onClick={() => window.dispatchEvent(new Event('vb:edit-label'))}>
              <Type size={15} />
            </IconAction>
          )}

          <span className="mx-0.5 h-5 w-px bg-line-2" aria-hidden="true" />
          <IconAction label="Bring to front" shortcut={['⌘', ']']} onClick={() => store.reorder(ids, 'front')}>
            <BringToFront size={15} />
          </IconAction>
          <IconAction label="Send to back" shortcut={['⌘', '[']} onClick={() => store.reorder(ids, 'back')}>
            <SendToBack size={15} />
          </IconAction>
          <IconAction label="Duplicate" shortcut={['⌘', 'D']} onClick={() => store.duplicateElements(ids)}>
            <Copy size={15} />
          </IconAction>
          <IconAction label={allLocked ? 'Unlock' : 'Lock'} shortcut={['⌘', 'L']} active={allLocked} onClick={() => store.setLocked(ids, !allLocked)}>
            {allLocked ? <Lock size={15} /> : <Unlock size={15} />}
          </IconAction>
          {single && (
            <IconAction
              label="Comment"
              onClick={() =>
                useUIStore.getState().setActiveComment({ elementId: first.id, x: first.x + first.width * (first.scaleX ?? 1), y: first.y })
              }
            >
              <MessageSquarePlus size={15} />
            </IconAction>
          )}
          <span className="mx-0.5 h-5 w-px bg-line-2" aria-hidden="true" />
          <IconAction label="Delete" shortcut={['⌫']} danger onClick={() => store.removeElements(ids)}>
            <Trash2 size={15} />
          </IconAction>
        </div>

        <AnimatePresence>
          {popover && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
              // Open away from the selection so it never covers what you're editing.
              className={cn('glass absolute left-0 rounded-xl p-2.5', placedBelow ? 'top-full mt-2' : 'bottom-full mb-2')}
              role="dialog"
              aria-label={`${popover} options`}
            >
              {popover === 'color' && (
                <div className="space-y-2">
                  {canFill && (
                    <div>
                      <p className="mb-1 font-mono text-[9.5px] uppercase tracking-wide text-ink-3">Fill</p>
                      <div className="flex gap-0.5">
                        {FILLS.map((c) => (
                          <Swatch key={c.value} color={c.value} label={`Fill ${c.name}`} active={first.fill === c.value} onClick={() => apply({ fill: c.value }, FILLABLE)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {canStroke && (
                    <div>
                      <p className="mb-1 font-mono text-[9.5px] uppercase tracking-wide text-ink-3">Stroke</p>
                      <div className="flex gap-0.5">
                        {STROKES.map((c) => (
                          <Swatch key={c.value} color={c.value} label={`Stroke ${c.name}`} active={first.stroke === c.value} onClick={() => apply({ stroke: c.value }, STROKABLE)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {popover === 'stroke' && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {WIDTHS.map((w) => (
                      <button
                        key={w}
                        onClick={() => apply({ strokeWidth: w }, STROKABLE)}
                        aria-label={`Stroke width ${w}`}
                        className={cn('island-btn h-8 w-10', first.strokeWidth === w && 'bg-paper-3 text-ink')}
                      >
                        <span className="w-6 rounded-full bg-current" style={{ height: w }} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {STYLES.map((st) => (
                      <button
                        key={st.value}
                        onClick={() => apply({ strokeStyle: st.value }, STROKABLE)}
                        aria-label={`${st.value} stroke`}
                        className={cn('island-btn h-8 w-10', (first.strokeStyle ?? 'solid') === st.value && 'bg-paper-3 text-ink')}
                      >
                        <svg width="26" height="4" aria-hidden="true">
                          <line x1="1" y1="2" x2="25" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray={st.dash} strokeLinecap="round" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(popover === 'startMarker' || popover === 'endMarker') && (
                <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label={popover === 'startMarker' ? 'Start marker' : 'End marker'}>
                  {MARKERS.map((mk) => {
                    const current = popover === 'startMarker' ? conn.startMarker : conn.endMarker;
                    return (
                      <button
                        key={mk}
                        role="radio"
                        aria-checked={current === mk}
                        aria-label={MARKER_LABEL[mk]}
                        title={MARKER_LABEL[mk]}
                        onClick={() => apply(popover === 'startMarker' ? { startMarker: mk } : { endMarker: mk })}
                        className={cn('island-btn h-9 w-12', current === mk && 'bg-paper-3 text-ink')}
                      >
                        <MarkerGlyph marker={mk} flip={popover === 'startMarker'} />
                      </button>
                    );
                  })}
                </div>
              )}
              {popover === 'size' && (
                <div className="flex gap-1">
                  {SIZES.map((sz) => (
                    <button
                      key={sz.value}
                      onClick={() => apply({ fontSize: sz.value })}
                      aria-label={`Text size ${sz.label}`}
                      className={cn('island-btn h-8 w-9 font-mono text-[11px] font-semibold', first.fontSize === sz.value && 'bg-paper-3 text-ink')}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
