import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  MessageSquareText,
  Check,
  Wand2,
} from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { heroEntranceTimeline, heroAmbientLoop } from '../../animations/heroAnimations';

const BOARD_W = 576;
const BOARD_H = 360;

interface NodeSpec {
  label: string;
  sub: string;
  x: number;
  y: number;
  accent?: boolean;
}

const NODES: NodeSpec[] = [
  { label: 'User', sub: 'client', x: 16, y: 176 },
  { label: 'Frontend', sub: 'react · web', x: 168, y: 180 },
  { label: 'API Gateway', sub: 'auth · rate-limit', x: 308, y: 88, accent: true },
  { label: 'PostgreSQL', sub: 'primary store', x: 308, y: 262 },
  { label: 'Redis Cache', sub: 'sessions', x: 446, y: 88 },
];

const CONNECTORS: Array<[number, number, number, number]> = [
  [148, 199, 168, 203],
  [300, 203, 306, 134],
  [374, 134, 374, 262],
  [440, 111, 446, 111],
  [374, 170, 446, 156],
];

export default function HeroCanvas() {
  const frameRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const cursorLabelRef = useRef<HTMLDivElement>(null);

  const nodeRefs = useRef<Array<HTMLDivElement | null>>([]);
  const connRefs = useRef<Array<SVGLineElement | null>>([]);

  const noteRef = useRef<HTMLDivElement>(null);
  const docChipRef = useRef<HTMLDivElement>(null);
  const commentBubbleRef = useRef<HTMLDivElement>(null);
  const suggestionChipRef = useRef<HTMLDivElement>(null);
  const arrangePulseRef = useRef<HTMLDivElement>(null);

  const reduced = useReducedMotion();
  const [scale, setScale] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const measure = () => {
      const el = frameRef.current;
      if (!el) return;
      setScale(Math.min(1, el.getBoundingClientRect().width / BOARD_W));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (frameRef.current) ro.observe(frameRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const refs = {
      nodes: nodeRefs,
      connectors: connRefs,
      note: noteRef,
      docChip: docChipRef,
      commentBubble: commentBubbleRef,
      cursor: cursorRef,
      cursorLabel: cursorLabelRef,
      arrangePulse: arrangePulseRef,
    };

    if (reduced) {
      for (const r of [noteRef, docChipRef, commentBubbleRef, suggestionChipRef, cursorRef]) {
        if (r.current) r.current.style.opacity = '1';
      }
      return;
    }

    const entrance = heroEntranceTimeline(refs);
    entrance
      .to(suggestionChipRef.current, { opacity: 1, scale: 1, duration: 0.4 }, 0.6)
      .fromTo(suggestionChipRef.current, { y: 6 }, { y: 0, duration: 0.4 }, 0.6);

    const killLoop = heroAmbientLoop(refs, reduced);
    const t = setTimeout(() => entrance.play(), 300);

    return () => {
      clearTimeout(t);
      entrance.kill();
      killLoop();
    };
  }, [mounted, reduced]);

  const scaledHeight = BOARD_H * scale + 44 * scale;

  return (
    <div ref={frameRef} className="relative w-full" style={{ minHeight: '340px' }}>
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: BOARD_W,
          height: scaledHeight,
          transform: `scale(${scale})`,
        }}
      >
        <div className="overflow-hidden rounded-xl border border-line-2 bg-board shadow-md">
          <div className="flex h-[44px] items-center justify-between border-b border-line bg-paper-2/70 px-4">
            <div className="flex items-center gap-2.5">
              <span className="flex gap-1.5" aria-hidden="true">
                <span className="h-2 w-2 rounded-full bg-line-3" />
                <span className="h-2 w-2 rounded-full bg-line-3" />
                <span className="h-2 w-2 rounded-full bg-accent/70" />
              </span>
              <span className="ml-1 text-[13px] font-medium text-ink">Checkout Architecture</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-ink-3">
                <span className="h-1 w-1 rounded-full bg-success" />
                Saved
              </span>
              <span className="flex -space-x-1.5" aria-hidden="true">
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-paper bg-accent text-[8px] font-semibold text-white">P</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-paper bg-blue-600 text-[8px] font-semibold text-white">A</span>
                <span className="flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-paper bg-violet-600 text-[8px] font-semibold text-white">M</span>
              </span>
            </div>
          </div>

          <div className="grid-paper grid-paper-fine relative overflow-hidden" style={{ width: BOARD_W, height: BOARD_H }}>
            <svg
              width={BOARD_W}
              height={BOARD_H}
              className="absolute inset-0"
              aria-hidden="true"
            >
              <defs>
                <marker id="hc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 z" fill="#b0aea2" />
                </marker>
              </defs>
              {CONNECTORS.map(([x1, y1, x2, y2], i) => (
                <line
                  key={i}
                  ref={(el) => {
                    connRefs.current[i] = el;
                  }}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#b0aea2"
                  strokeWidth="1.75"
                  markerEnd="url(#hc-arrow)"
                />
              ))}
            </svg>

            {NODES.map((node, i) => (
              <div
                key={node.label}
                ref={(el) => {
                  nodeRefs.current[i] = el;
                }}
                className={[
                  'absolute flex h-[46px] w-[132px] flex-col justify-center rounded-lg border px-3.5 shadow-xs transition-colors',
                  node.accent
                    ? 'border-accent/60 bg-accent-softer'
                    : 'border-line-2 bg-paper',
                ].join(' ')}
                style={{ left: node.x, top: node.y }}
              >
                <span className="text-[12px] font-semibold leading-tight text-ink">{node.label}</span>
                <span className="mt-0.5 font-mono text-[9px] leading-tight tracking-wide text-ink-3">{node.sub}</span>
              </div>
            ))}

            <div
              ref={noteRef}
              className="absolute flex h-[82px] w-[124px] flex-col items-center justify-center rounded-lg border border-[#e6cf74] bg-sticky px-3 shadow-xs"
              style={{ left: 428, top: 252, rotate: '1.5deg' }}
            >
              <span className="text-[11px] font-medium leading-snug text-[#4a3f16]">
                Rate limit before the gateway
              </span>
            </div>

            <div
              ref={docChipRef}
              className="absolute flex h-[26px] items-center gap-1.5 rounded-md border border-line-2 bg-paper px-2 shadow-xs"
              style={{ left: 318, top: 138 }}
            >
              <FileText size={11} className="text-accent" />
              <span className="font-mono text-[9.5px] text-ink-2">architecture.pdf</span>
            </div>

            <div
              ref={suggestionChipRef}
              className="mono-label absolute flex h-[24px] items-center gap-1.5 rounded-md border border-accent/30 bg-accent-soft px-2.5 text-[9px] text-accent shadow-xs"
              style={{ left: 236, top: 118 }}
            >
              <Wand2 size={10} /> + add auth layer
            </div>

            <div
              ref={commentBubbleRef}
              className="absolute flex h-[44px] max-w-[160px] items-start gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1.5 shadow-sm"
              style={{ left: 226, top: 240 }}
            >
              <MessageSquareText size={11} className="mt-0.5 shrink-0 text-blue-600" />
              <span className="text-[10px] leading-snug text-ink-2">
                index on <span className="font-mono text-ink">orders(id)</span>?
              </span>
            </div>

            <div
              ref={arrangePulseRef}
              className="mono-label absolute flex h-[26px] items-center gap-1.5 rounded-md border border-success/25 bg-success-soft px-2.5 text-[9px] text-success"
              style={{ left: 222, top: 8, opacity: 0 }}
            >
              <Check size={11} /> ARRANGED
            </div>

            <div ref={cursorRef} className="absolute" style={{ left: 8, top: 8, opacity: 0 }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M5.5 3.2l12.8 6.8-6 2.2-3.4 6L5.5 3.2z"
                  fill="#d9480f"
                  stroke="#fff"
                  strokeWidth="1.4"
                />
              </svg>
              <div
                ref={cursorLabelRef}
                className="absolute left-3.5 top-3 flex h-[18px] items-center whitespace-nowrap rounded-sm bg-[#d9480f] px-1.5 text-[9.5px] font-medium text-white"
              >
                Aisha
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}