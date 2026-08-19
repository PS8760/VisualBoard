import { useEffect, useRef } from 'react';
import { Container, Section, SectionHeading } from '../../components/ui/Section';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { drawPathsOnScroll } from '../../animations/scrollAnimations';

const LAYERS = [
  { label: 'Client', sub: 'browser · spa', y: 28 },
  { label: 'API Gateway', sub: 'edge · routing', y: 108 },
  { label: 'Auth Service', sub: 'jwt · sessions', y: 188 },
  { label: 'Application Service', sub: 'domain logic', y: 268 },
  { label: 'PostgreSQL', sub: 'primary store', y: 348 },
];

const NOTES = [
  ['01', 'every hop logs to a single pipeline'],
  ['02', 'auth is a service, not a library'],
  ['03', 'retries live at the client, not the gateway'],
];

export default function Architecture() {
  const diagramRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef<Array<SVGPathElement | null>>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    const paths = pathRefs.current.filter((p): p is SVGPathElement => p !== null);
    return drawPathsOnScroll(diagramRef.current, paths);
  }, [reduced]);

  return (
    <Section id="for-engineers" className="border-t border-line bg-paper overflow-hidden">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1fr] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="For engineers"
              title="From rough ideas to production-ready architecture."
              description="VisualBoard is a whiteboard that speaks the language of systems. Draw the flow, let the board flag what's missing, and walk into the review with a diagram that holds up."
            />
            <ul className="mt-9 space-y-3" aria-label="Architecture notes">
              {NOTES.map(([num, text], i) => (
                <li
                  key={num}
                  data-reveal
                  data-reveal-delay={String(i * 0.08)}
                  className="flex items-center gap-3 font-mono text-[12.5px] text-ink-2"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-sm border border-line bg-paper text-[10px] text-accent shadow-xs">
                    {num}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <div ref={diagramRef} data-reveal className="relative">
            <div className="relative mx-auto w-full max-w-[420px]">
              <svg
                className="absolute left-1/2 top-0 h-full -translate-x-1/2"
                width="2"
                height="100%"
                aria-hidden="true"
              >
                {LAYERS.slice(0, -1).map((_, i) => (
                  <path
                    key={i}
                    ref={(el) => {
                      pathRefs.current[i] = el;
                    }}
                    d={`M 1 ${LAYERS[i]!.y + 56} L 1 ${LAYERS[i + 1]!.y - 6}`}
                    stroke="#d9480f"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    opacity="0.85"
                  />
                ))}
              </svg>

              <div className="flex flex-col items-center gap-0">
                {LAYERS.map((layer, i) => (
                  <div key={layer.label} className="relative">
                    <div
                      className={[
                        'flex h-[50px] w-[230px] flex-col items-center justify-center rounded-lg border bg-paper shadow-xs transition-shadow duration-200 hover:shadow-md',
                        i === 1 ? 'border-accent/50 bg-accent-softer' : 'border-line-2',
                      ].join(' ')}
                    >
                      <span className="text-[13px] font-semibold text-ink">{layer.label}</span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-ink-3">
                        {layer.sub}
                      </span>
                    </div>
                    {i < LAYERS.length - 1 && (
                      <span className="absolute left-1/2 top-full h-[10px] w-px -translate-x-1/2 bg-line" aria-hidden="true" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="mx-auto mt-10 max-w-[420px] rounded-md border border-line bg-paper-2/60 p-3 font-mono text-[10.5px] leading-relaxed text-ink-3">
              <span className="text-ink-2">$ visualboard arrange</span>
              <br />
              <span className="text-success">✓</span> 5 elements · 4 connections · layers aligned
              <br />
              <span className="text-accent">+</span> suggestion: authentication layer in front of the app service
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}