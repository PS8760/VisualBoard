import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Wand2, CheckCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Container, Section, SectionHeading } from '../../components/ui/Section';
import { useReducedMotion } from '../../hooks/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const W = 680;
const H = 380;

interface MessyNode {
  id: string;
  label: string;
  sub: string;
  messy: { x: number; y: number; r: number };
  clean: { x: number; y: number };
  accent?: boolean;
}

const NODES: MessyNode[] = [
  { id: 'n-api', label: 'API', sub: '?', messy: { x: 92, y: 88, r: 7 }, clean: { x: 64, y: 70 } },
  { id: 'n-auth', label: 'Auth', sub: '?', messy: { x: 352, y: 58, r: -5 }, clean: { x: 270, y: 70 } },
  { id: 'n-cache', label: 'Redis', sub: '?', messy: { x: 528, y: 92, r: 4 }, clean: { x: 476, y: 70 } },
  { id: 'n-db', label: 'PostgreSQL', sub: '?', messy: { x: 108, y: 252, r: 11 }, clean: { x: 64, y: 258 } },
  { id: 'n-queue', label: 'Queue', sub: '?', messy: { x: 372, y: 232, r: -8 }, clean: { x: 270, y: 258 } },
  { id: 'n-doc', label: 'spec.md', sub: '?', messy: { x: 534, y: 264, r: -6 }, clean: { x: 476, y: 258 } },
];

const CLUTTER = [
  { id: 'c-note1', label: '??', x: 248, y: 150, r: 14 },
  { id: 'c-note2', label: 'draft', x: 484, y: 176, r: -12 },
  { id: 'c-text', label: '„this keeps growing…"', x: 236, y: 34, r: 0 },
];

export default function Problem() {
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const clutterRefs = useRef<Array<HTMLDivElement | null>>([]);
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [arranged, setArranged] = useState(false);
  const reduced = useReducedMotion();

  const runArrange = (play = true) => {
    const el = stageRef.current;
    if (!el) return;

    if (reduced) {
      el.querySelectorAll<HTMLElement>('[data-node]').forEach((n) => {
        const id = n.dataset.nodeId;
        const spec = NODES.find((x) => x.id === id);
        if (spec) gsap.set(n, { x: spec.clean.x, y: spec.clean.y, rotation: 0 });
      });
      setArranged(true);
      return;
    }

    const tl = gsap.timeline({
      onStart: () => setArranged(false),
      onComplete: () => setArranged(true),
    });
    if (!play) tl.progress(1);

    tl.to(clutterRefs.current.filter(Boolean), {
      opacity: 0,
      scale: 0.9,
      rotation: 0,
      duration: 0.35,
      stagger: 0.04,
      ease: 'power2.in',
    })
      .to(
        el.querySelectorAll<HTMLElement>('[data-node]'),
        {
          x: (i) => NODES[i]?.clean.x ?? 0,
          y: (i) => NODES[i]?.clean.y ?? 0,
          rotation: 0,
          duration: 0.8,
          ease: 'power3.inOut',
        },
        0.1,
      )
      .to(lineRefs.current.filter(Boolean), { opacity: 1, duration: 0.4, stagger: 0.06 }, 0.55)
      .fromTo(badgeRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 }, 0.9);
  };

  useEffect(() => {
    const st = ScrollTrigger.create({
      trigger: boardRef.current,
      start: 'top 78%',
      once: true,
      onEnter: () => {
        if (reduced) {
          runArrange(false);
        } else {
          setTimeout(() => runArrange(), 250);
        }
      },
    });
    return () => st.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const lines: Array<[number, number, number, number]> = [
    [237, 98, 270, 98],
    [237, 286, 270, 286],
    [443, 98, 476, 98],
    [443, 286, 476, 286],
    [154, 98, 154, 286],
    [360, 98, 360, 286],
  ];

  return (
    <Section id="features" className="border-t border-line bg-paper">
      <Container>
        <SectionHeading
          eyebrow="Why a canvas"
          title={
            <>
              Ideas get messy.
              <br />
              Your workspace shouldn&rsquo;t.
            </>
          }
          description="Whiteboards start clean and end chaotic. VisualBoard keeps your board legible — one action turns scattered thoughts into a structured layout you can follow."
        />

        <div ref={boardRef} data-reveal className="mt-14">
          <div className="overflow-hidden rounded-xl border border-line-2 bg-board shadow-sm">
            <div className="flex h-10 items-center justify-between border-b border-line bg-paper-2/70 px-4">
              <span className="text-[12.5px] font-medium text-ink">Week 3 — platform review</span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">
                {arranged ? 'auto-arranged' : 'raw board'}
              </span>
            </div>

            <div
              ref={stageRef}
              className="relative grid-paper grid-paper-fine overflow-hidden"
              style={{ width: '100%', height: H, minHeight: 280 }}
            >
              <svg
                width={W}
                height={H}
                className="absolute left-0 top-0 hidden md:block"
                aria-hidden="true"
              >
                {lines.map(([x1, y1, x2, y2], i) => (
                  <line
                    key={i}
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke="#b0aea2" strokeWidth="1.75" opacity={0}
                    strokeDasharray="5 4"
                  />
                ))}
              </svg>

              {/* clutter */}
              {CLUTTER.map((c, i) => (
                <div
                  key={c.id}
                  ref={(el) => {
                    clutterRefs.current[i] = el;
                  }}
                  className="absolute hidden md:flex"
                  style={{ left: c.x, top: c.y, transform: `rotate(${c.r}deg)` }}
                >
                  <span className="rounded-md border border-line-2 bg-paper px-3 py-1.5 font-mono text-[11px] text-ink-3 shadow-xs">
                    {c.label}
                  </span>
                </div>
              ))}

              {NODES.map((node) => (
                <div
                  key={node.id}
                  data-node
                  data-node-id={node.id}
                  className="absolute hidden h-[56px] w-[170px] flex-col justify-center rounded-lg border bg-paper px-4 shadow-xs md:flex"
                  style={{
                    left: node.messy.x,
                    top: node.messy.y,
                    transform: `rotate(${node.messy.r}deg)`,
                    borderColor: node.accent ? 'rgba(217,72,15,0.5)' : 'var(--color-line-2)',
                  }}
                >
                  <span className="text-[13px] font-semibold text-ink">{node.label}</span>
                  <span className="font-mono text-[10px] text-ink-3">
                    {node.id === 'n-api' ? 'not deployed' : node.id === 'n-auth' ? 'TBD' : node.id === 'n-doc' ? 'v0.2' : node.id === 'n-db' ? 'migrations pending' : node.id === 'n-queue' ? 'one consumer' : 'no policy'}
                  </span>
                </div>
              ))}

              <div
                ref={badgeRef}
                className="absolute right-4 top-3 flex items-center gap-1.5 rounded-md border border-success/25 bg-success-soft px-2.5 py-1.5 font-mono text-[10px] font-medium text-success"
                style={{ opacity: 0 }}
              >
                <CheckCheck size={12} /> 6 ELEMENTS ARRANGED
              </div>

              {/* mobile fallback */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center md:hidden">
                <span className="max-w-xs text-[13px] leading-relaxed text-ink-2">
                  One action turns a chaotic board into a clean, logical layout.
                </span>
                <span className="font-mono text-[10px] text-ink-3">arrange → board.diagram</span>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="font-mono text-[11px] text-ink-3">
              <span className="text-ink-2">before</span>
              <span className="mx-2 text-line-3">→</span>
              <span className="text-success">after arrange</span>
            </p>
            <Button
              variant="secondary"
              size="sm"
              icon={<Wand2 size={13} />}
              onClick={() => runArrange(!arranged)}
            >
              {arranged ? 'Replay' : 'Arrange elements'}
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}