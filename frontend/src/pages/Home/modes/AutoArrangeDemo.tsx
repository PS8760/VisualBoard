import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Wand2, CheckCheck } from 'lucide-react';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

const ITEMS = [
  { id: 'one', label: 'Frontend', messy: [48, 64, 6], clean: [40, 48] },
  { id: 'two', label: 'API', messy: [320, 40, -5], clean: [230, 48] },
  { id: 'three', label: 'Auth', messy: [120, 210, 9], clean: [420, 48] },
  { id: 'four', label: 'Postgres', messy: [360, 190, -8], clean: [40, 196] },
  { id: 'five', label: 'Cache', messy: [200, 130, 12], clean: [230, 196] },
  { id: 'six', label: 'Queue', messy: [440, 110, 5], clean: [420, 196] },
];

export default function AutoArrangeDemo() {
  const stageRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Array<SVGLineElement | null>>([]);
  const [arranged, setArranged] = useState(false);
  const reduced = useReducedMotion();

  const arrange = (auto = false) => {
    const stage = stageRef.current;
    if (!stage) return;
    const nodes = stage.querySelectorAll<HTMLElement>('[data-dd]');

    const tl = gsap.timeline({
      onStart: () => setArranged(false),
      onComplete: () => setArranged(true),
    });

    tl.to(
      nodes,
      {
        x: (i) => ITEMS[i]!.clean[0],
        y: (i) => ITEMS[i]!.clean[1],
        rotation: 0,
        duration: 0.8,
        ease: 'power3.inOut',
      },
      0,
    )
      .to(lineRefs.current.filter(Boolean), { opacity: 1, duration: 0.4, stagger: 0.05 }, 0.4)
      .fromTo(badgeRef.current, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: 0.25 }, 0.7);

    if (!auto && reduced) {
      tl.progress(1);
    }
  };

  useEffect(() => {
    if (!stageRef.current) return;
    const t = setTimeout(() => arrange(true), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const lines: Array<[number, number, number, number]> = [
    [218, 76, 230, 76],
    [408, 76, 420, 76],
    [127, 76, 127, 196],
    [317, 76, 317, 196],
    [507, 76, 507, 196],
  ];

  return (
    <div className="overflow-hidden rounded-lg border border-line-2 bg-board shadow-xs">
      <div className="flex h-9 items-center justify-between border-b border-line bg-paper-2/70 px-3">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">
          board demo · live
        </span>
        <button
          onClick={() => arrange(false)}
          disabled={arranged}
          className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-accent px-2.5 text-[11.5px] font-medium text-white transition-colors hover:bg-accent-2 disabled:pointer-events-none disabled:opacity-60"
        >
          <Wand2 size={12} />
          Arrange
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative h-[300px] grid-paper grid-paper-fine overflow-hidden"
      >
        <svg width="560" height="300" className="absolute inset-0 hidden md:block" aria-hidden="true">
          {lines.map(([x1, y1, x2, y2], i) => (
            <line
              key={i}
              ref={(el) => {
                lineRefs.current[i] = el;
              }}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#b0aea2"
              strokeWidth="1.75"
              opacity={0}
            />
          ))}
        </svg>

        {ITEMS.map((item) => (
          <div
            key={item.id}
            data-dd
            className="absolute hidden h-[52px] w-[150px] items-center justify-center rounded-lg border border-line-2 bg-paper px-3 shadow-xs md:flex"
            style={{
              left: item.messy[0],
              top: item.messy[1],
              transform: `rotate(${item.messy[2]}deg)`,
            }}
          >
            <span className="text-[12.5px] font-semibold text-ink">{item.label}</span>
          </div>
        ))}

        <div
          ref={badgeRef}
          className="absolute bottom-3 right-3 flex h-7 items-center gap-1.5 rounded-md border border-success/25 bg-success-soft px-2.5 font-mono text-[10px] font-medium text-success"
          style={{ opacity: 0 }}
        >
          <CheckCheck size={12} /> ARRANGED
        </div>

        <div className="absolute inset-0 flex items-center justify-center md:hidden">
          <span className="px-6 text-center text-[12.5px] leading-relaxed text-ink-2">
            One click. The canvas computes a logical layout and everything glides into place.
          </span>
        </div>
      </div>
    </div>
  );
}