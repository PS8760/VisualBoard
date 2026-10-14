import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, ArrowLeft, Check, MousePointer2, Hand, PenLine, Square, Circle, Minus, Type, StickyNote,
  Image, FileText, PanelRight, Undo2, Wand2, Command, Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Kbd } from '../../components/ui/Kbd';
import { useUIStore } from '../../stores/useUIStore';
import { REPLAY_TOUR_EVENT } from '../../utils/shortcuts';

const STORAGE_KEY = 'vb_onboarding_seen';

interface TourItem {
  icon: LucideIcon;
  label: string;
  keys?: string[];
  hint: string;
}

interface TourStep {
  id: string;
  title: string;
  description: string;
  /** `data-tour` anchors to spotlight; several are merged into one highlight. */
  targets?: string[];
  /** Fallback anchors when the primary ones are not rendered (e.g. panel open/closed). */
  fallbackTargets?: string[];
  items?: TourItem[];
  /** Opens the UI the step talks about; the previous state is restored on leave. */
  revealPanel?: boolean;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to VisualBoard',
    description:
      'A quick tour of the tools. Everything you do here is saved automatically and shared live with everyone on this board.',
  },
  {
    id: 'navigate',
    title: 'Select & move around',
    description: 'Start here to pick things up and move around the infinite canvas.',
    targets: ['tool-select', 'tool-hand'],
    items: [
      { icon: MousePointer2, label: 'Select', keys: ['V'], hint: 'Click to select, drag a box to select many, drag handles to resize or rotate.' },
      { icon: Hand, label: 'Hand', keys: ['H'], hint: 'Drag to pan. Or hold Space with any tool. Zoom with ⌘/Ctrl + scroll or pinch.' },
    ],
  },
  {
    id: 'draw',
    title: 'Draw & diagram',
    description: 'Pick a tool, then drag on the canvas. Hold Shift for perfect squares/circles and 45° lines.',
    targets: ['tool-pen', 'tool-rect', 'tool-circle', 'tool-line', 'tool-arrow'],
    items: [
      { icon: PenLine, label: 'Pen', keys: ['P'], hint: 'Freehand sketching — width and color appear in a mini toolbar.' },
      { icon: Square, label: 'Rectangle', keys: ['R'], hint: 'Boxes for services, steps and groups.' },
      { icon: Circle, label: 'Circle', keys: ['O'], hint: 'Nodes, states and highlights.' },
      { icon: Minus, label: 'Line / Arrow', keys: ['L', 'A'], hint: 'Connect things and show direction of flow.' },
    ],
  },
  {
    id: 'write',
    title: 'Text & sticky notes',
    description: 'Click once to place, then type. Double-click any text or note later to edit it.',
    targets: ['tool-text', 'tool-sticky'],
    items: [
      { icon: Type, label: 'Text', keys: ['T'], hint: 'Labels and headings anywhere on the canvas.' },
      { icon: StickyNote, label: 'Sticky note', keys: ['S'], hint: 'Quick ideas and to-dos your team can see instantly.' },
    ],
  },
  {
    id: 'media',
    title: 'Images & documents',
    description: 'You can also drag files straight from your computer onto the canvas — or onto an element to attach them to it.',
    targets: ['tool-image', 'tool-document'],
    items: [
      { icon: Image, label: 'Image', keys: ['I'], hint: 'Place a PNG, JPEG or WebP on the board.' },
      { icon: FileText, label: 'Document', keys: ['D'], hint: 'Attach PDFs, docs, sheets or text (up to 10 MB) with inline preview.' },
    ],
  },
  {
    id: 'comment',
    title: 'Comment threads',
    description:
      'Press C, then click an element or any empty spot to start a thread. Pins stay attached while you pan, zoom or move the element — click one to read and reply.',
    targets: ['tool-comment'],
  },
  {
    id: 'panel',
    title: 'Side panel',
    description: 'Inspect and style the selection, browse every comment and attached document, and ask the AI reviewer for suggestions.',
    targets: ['panel'],
    revealPanel: true,
    items: [
      { icon: PanelRight, label: 'Info', hint: 'Fill, stroke, font size and opacity of the selection.' },
      { icon: Sparkles, label: 'Suggestions', hint: 'AI analysis of your board for gaps and risks.' },
    ],
  },
  {
    id: 'history',
    title: 'Version history',
    description:
      'The board snapshots itself automatically as you work. Open the timeline to save a checkpoint or restore an earlier version for everyone.',
    targets: ['history'],
  },
  {
    id: 'share',
    title: 'Collaborate live',
    description: 'Copy the link to invite people. Collaborators appear here, and you see their cursors and edits in real time.',
    targets: ['share', 'presence'],
    fallbackTargets: ['share'],
  },
  {
    id: 'bottom',
    title: 'Undo, arrange & commands',
    description: 'Undo only reverts your own changes, never your teammates’. Auto Arrange tidies the layout in one click.',
    targets: ['arrange', 'undo', 'redo'],
    items: [
      { icon: Undo2, label: 'Undo / Redo', keys: ['⌘', 'Z'], hint: 'Add Shift to redo.' },
      { icon: Wand2, label: 'Auto Arrange', keys: ['⇧', 'A'], hint: 'Lay elements out in a clean structure.' },
      { icon: Command, label: 'Commands', keys: ['⌘', 'K'], hint: 'Search every action and shortcut.' },
    ],
  },
  {
    id: 'done',
    title: 'You’re all set',
    description: 'Press Esc anytime to return to the Select tool. You can replay this tour from the Help button (?) in the corner.',
  },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PAD = 6;
const GAP = 14;
const CARD_W = 360;
const MARGIN = 12;

function measure(step: TourStep): Box | null {
  const find = (ids?: string[]) =>
    (ids ?? [])
      .flatMap((id) => Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`)))
      .map((el) => el.getBoundingClientRect())
      .filter((r) => r.width > 0 && r.height > 0);
  let rects = find(step.targets);
  if (!rects.length) rects = find(step.fallbackTargets);
  if (!rects.length) return null;
  // Keep the ring fully on screen for controls touching the viewport edge.
  const top = Math.max(2, Math.min(...rects.map((r) => r.top)) - PAD);
  const left = Math.max(2, Math.min(...rects.map((r) => r.left)) - PAD);
  const bottom = Math.min(window.innerHeight - 2, Math.max(...rects.map((r) => r.bottom)) + PAD);
  const right = Math.min(window.innerWidth - 2, Math.max(...rects.map((r) => r.right)) + PAD);
  return { top, left, width: right - left, height: bottom - top };
}

/** Places the card beside the highlight: right of it, else below/above/left, clamped to the viewport. */
function placeCard(box: Box | null, cardH: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = Math.min(CARD_W, vw - MARGIN * 2);
  const clampX = (x: number) => Math.max(MARGIN, Math.min(x, vw - w - MARGIN));
  const clampY = (y: number) => Math.max(MARGIN, Math.min(y, vh - cardH - MARGIN));
  if (!box) return { left: (vw - w) / 2, top: Math.max(MARGIN, (vh - cardH) / 2), width: w };

  const right = box.left + box.width + GAP;
  if (right + w <= vw - MARGIN) return { left: right, top: clampY(box.top + box.height / 2 - cardH / 2), width: w };
  const below = box.top + box.height + GAP;
  if (below + cardH <= vh - MARGIN) return { left: clampX(box.left + box.width / 2 - w / 2), top: below, width: w };
  const above = box.top - GAP - cardH;
  if (above >= MARGIN) return { left: clampX(box.left + box.width / 2 - w / 2), top: above, width: w };
  return { left: clampX(box.left - GAP - w), top: clampY(box.top), width: w };
}

export default function OnboardingOverlay() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [cardH, setCardH] = useState(260);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let seen = false;
    try {
      seen = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      // storage unavailable — show the tour once per session
    }
    const timer = seen ? undefined : setTimeout(() => setShow(true), 800);
    const replay = () => {
      setStep(0);
      setShow(true);
    };
    window.addEventListener(REPLAY_TOUR_EVENT, replay);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(REPLAY_TOUR_EVENT, replay);
    };
  }, []);

  const current = STEPS[step]!;
  const isFirst = step === 0;
  const isLast = step === STEPS.length - 1;

  const complete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
    setShow(false);
  }, []);

  const go = useCallback(
    (delta: number) => {
      if (delta > 0 && isLast) return complete();
      setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
    },
    [isLast, complete],
  );

  // Steps can open the UI they describe (e.g. the side panel) for the duration
  // of the step. Layout effect + declared first, so it runs before measuring.
  useLayoutEffect(() => {
    if (!show || !current.revealPanel) return;
    const ui = useUIStore.getState();
    const wasOpen = ui.rightPanelOpen;
    const previousTab = ui.rightPanelTab;
    ui.setRightPanelTab('info');
    return () => {
      const after = useUIStore.getState();
      after.setRightPanelTab(previousTab);
      after.setRightPanel(wasOpen);
    };
  }, [show, current]);

  // Track the highlighted UI (layout changes, panel opening, window resize).
  useLayoutEffect(() => {
    if (!show) return;
    const update = () => {
      const next = measure(current);
      setBox((prev) =>
        prev && next && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height
          ? prev
          : next,
      );
    };
    update();
    // Follow the target every frame while revealed UI animates in, then poll lightly.
    const started = performance.now();
    let frame = requestAnimationFrame(function tick() {
      update();
      if (performance.now() - started < 700) frame = requestAnimationFrame(tick);
    });
    const interval = window.setInterval(update, 500);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener('resize', update);
    };
  }, [show, current]);

  useLayoutEffect(() => {
    if (show && cardRef.current) setCardH(cardRef.current.offsetHeight);
  }, [show, step]);

  useEffect(() => {
    if (!show) return;
    nextRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      // Nothing reaches the board while the tour is open (tool keys, Delete,
      // ⌘Z…). Enter/Space still activate the focused button — that is a
      // default action, not a listener.
      e.stopPropagation();
      if (e.key === 'Escape') complete();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    // Capture phase: keep board shortcuts (tool keys, Esc) from firing underneath.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [show, step, go, complete]);

  if (!show) return null;

  const pos = placeCard(box, cardH);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby="vb-tour-title">
        {/* Click shield: the tour is a guided overview, not interactive. */}
        <div className="absolute inset-0" onMouseDown={(e) => e.preventDefault()} />

        {box ? (
          <motion.div
            className="pointer-events-none absolute rounded-lg ring-2 ring-accent"
            style={{ boxShadow: '0 0 0 9999px rgba(10, 10, 9, 0.55)' }}
            initial={false}
            animate={{ top: box.top, left: box.left, width: box.width, height: box.height }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <span className="absolute inset-0 animate-pulse rounded-lg ring-4 ring-accent/30" />
          </motion.div>
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-[rgba(10,10,9,0.55)]" />
        )}

        <motion.div
          ref={cardRef}
          key={current.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="absolute rounded-lg border border-line-2 bg-paper p-4 shadow-2xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-ink-3">
                {step + 1} / {STEPS.length}
              </p>
              <h2 id="vb-tour-title" className="mt-0.5 text-[15px] font-semibold text-ink">
                {current.title}
              </h2>
            </div>
            <button
              onClick={complete}
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
              aria-label="Close tour"
            >
              <X size={14} />
            </button>
          </div>

          <p className="text-[12.5px] leading-relaxed text-ink-2">{current.description}</p>

          {current.items && (
            <ul className="mt-3 space-y-2">
              {current.items.map((item) => (
                <li key={item.label} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                    <item.icon size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                      {item.label}
                      {item.keys?.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </span>
                    <span className="block text-[11.5px] leading-snug text-ink-3">{item.hint}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center justify-between gap-2">
            <button
              onClick={complete}
              className="text-[11.5px] text-ink-3 transition-colors hover:text-ink-2"
            >
              {isLast ? '' : 'Skip tour'}
            </button>
            <div className="flex items-center gap-1.5">
              {!isFirst && (
                <button
                  onClick={() => go(-1)}
                  className="flex h-8 items-center gap-1 rounded-sm border border-line-2 px-2.5 text-[12px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                  aria-label="Previous step"
                >
                  <ArrowLeft size={12} />
                </button>
              )}
              <button
                ref={nextRef}
                onClick={() => go(1)}
                className="flex h-8 items-center gap-1.5 rounded-sm bg-ink px-3 text-[12px] font-medium text-paper transition-colors hover:bg-black"
              >
                {isLast ? (
                  <>
                    <Check size={12} /> Start creating
                  </>
                ) : (
                  <>
                    {isFirst ? 'Show me around' : 'Next'} <ArrowRight size={12} />
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 flex justify-center gap-1" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1 rounded-full transition-all ${i === step ? 'w-5 bg-accent' : i < step ? 'w-1 bg-accent/40' : 'w-1 bg-line-2'}`}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
