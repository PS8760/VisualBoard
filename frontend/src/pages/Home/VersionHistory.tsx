import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock3 } from 'lucide-react';
import { Container, Section, SectionHeading } from '../../components/ui/Section';
import { useReveal } from '../../hooks/useReveal';
import { cn } from '../../utils';

interface Snapshot {
  id: string;
  label: string;
  meta: string;
  nodes: Array<{ x: string; y: string; w: string; accent?: boolean }>;
  conns: number;
}

const SNAPSHOTS: Snapshot[] = [
  {
    id: 'v1', label: 'V1', meta: 'initial sketch · 7 elements',
    nodes: [
      { x: '18%', y: '30%', w: '26%' }, { x: '52%', y: '30%', w: '26%' },
      { x: '18%', y: '62%', w: '26%' },
    ],
    conns: 2,
  },
  {
    id: 'v2', label: 'V2', meta: '+ caching layer · 11 elements',
    nodes: [
      { x: '12%', y: '26%', w: '20%' }, { x: '42%', y: '26%', w: '22%' }, { x: '72%', y: '22%', w: '18%', accent: true },
      { x: '12%', y: '60%', w: '20%' }, { x: '42%', y: '60%', w: '22%' },
    ],
    conns: 4,
  },
  {
    id: 'v3', label: 'V3', meta: 'auth extracted · notes attached · 15 elements',
    nodes: [
      { x: '8%', y: '20%', w: '18%' }, { x: '36%', y: '20%', w: '20%' }, { x: '64%', y: '18%', w: '20%', accent: true },
      { x: '8%', y: '52%', w: '18%' }, { x: '36%', y: '52%', w: '20%' }, { x: '64%', y: '52%', w: '20%' },
      { x: '84%', y: '40%', w: '12%' },
    ],
    conns: 6,
  },
  {
    id: 'cur', label: 'Current', meta: 'review session · comments · 19 elements',
    nodes: [
      { x: '8%', y: '18%', w: '16%' }, { x: '33%', y: '18%', w: '18%' }, { x: '60%', y: '16%', w: '18%', accent: true },
      { x: '8%', y: '48%', w: '16%' }, { x: '33%', y: '48%', w: '18%' }, { x: '60%', y: '48%', w: '18%' },
      { x: '83%', y: '30%', w: '12%' }, { x: '83%', y: '56%', w: '12%' },
    ],
    conns: 8,
  },
];

export default function VersionHistory() {
  const ref = useReveal<HTMLDivElement>();
  const [hovered, setHovered] = useState<number | null>(SNAPSHOTS.length - 1);

  return (
    <Section className="border-t border-line">
      <Container>
        <SectionHeading
          eyebrow="Version history"
          title="Every board remembers where it's been."
          description="Changes accumulate into versions automatically. Hover the timeline to preview how the board evolved — and restore the past with one click."
        />

        <div ref={ref} className="mt-14">
          <div data-reveal className="mx-auto grid max-w-4xl grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
            <div className="overflow-hidden rounded-xl border border-line-2 bg-board shadow-sm">
              <div className="flex h-9 items-center justify-between border-b border-line bg-paper-2/70 px-4">
                <span className="text-[12.5px] font-medium text-ink">Checkout Architecture</span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-ink-3">
                  <Clock3 size={11} />
                  {hovered !== null ? SNAPSHOTS[hovered].meta : ''}
                </span>
              </div>
              <motion.div
                key={hovered}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="relative h-[300px] grid-paper grid-paper-fine"
              >
                <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
                  {SNAPSHOTS[hovered ?? 3] &&
                    Array.from({ length: SNAPSHOTS[hovered ?? 3].conns }).map((_, i) => (
                      <line
                        key={i}
                        x1={`${12 + i * 13}%`} y1="40%" x2={`${30 + i * 6}%`} y2="58%"
                        stroke="#b0aea2" strokeWidth="1.5"
                      />
                    ))}
                </svg>
                {SNAPSHOTS[hovered ?? 3].nodes.map((n, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: i * 0.04 }}
                    className={cn(
                      'absolute flex h-[30px] items-center justify-center rounded-[5px] border text-[9px] font-medium text-ink',
                      n.accent ? 'border-accent/50 bg-accent-softer' : 'border-line-2 bg-paper',
                    )}
                    style={{ left: n.x, top: n.y, width: n.w }}
                  >
                    {n.accent ? 'gateway' : 'node'}
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <div className="flex flex-col justify-center gap-2">
              {SNAPSHOTS.map((snap, i) => {
                const active = hovered === i;
                const isLast = i === SNAPSHOTS.length - 1;
                return (
                  <div key={snap.id} className="relative flex items-stretch gap-3">
                    {i < SNAPSHOTS.length - 1 && (
                      <span
                        className={cn(
                          'absolute left-[9px] top-6 h-[calc(100%-8px)] w-px',
                          active ? 'bg-accent' : 'bg-line-2',
                        )}
                        aria-hidden="true"
                      />
                    )}
                    <button
                      onMouseEnter={() => setHovered(i)}
                      onFocus={() => setHovered(i)}
                      onClick={() => setHovered(i)}
                      className={cn(
                        'relative z-10 mt-1.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border-2 bg-paper transition-all duration-150',
                        active ? 'border-accent' : 'border-line-3 hover:border-line-2',
                      )}
                      aria-label={`Preview ${snap.label}`}
                      aria-pressed={active}
                    >
                      {isLast && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                    </button>
                    <div
                      className={cn(
                        'flex flex-1 items-center justify-between rounded-md border px-3 py-2 transition-all duration-150',
                        active ? 'border-line-2 bg-paper shadow-sm' : 'border-transparent',
                      )}
                    >
                      <span className={cn('text-[13px] font-semibold', active ? 'text-ink' : 'text-ink-2')}>
                        {snap.label === 'Current' ? 'Today — Current' : snap.label}
                      </span>
                      <span className="font-mono text-[10px] text-ink-3">{snap.meta.split('·')[0]}</span>
                    </div>
                  </div>
                );
              })}

              <div data-reveal className="mt-3 rounded-md border border-dashed border-line-2 p-3 font-mono text-[10.5px] leading-relaxed text-ink-3">
                <span className="text-ink-2">restore</span> — clicking a version rewinds the board.
                <br />
                Nothing is lost: history keeps everything.
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}