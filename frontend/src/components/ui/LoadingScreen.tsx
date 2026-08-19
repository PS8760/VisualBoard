import { useEffect, useRef, useState } from 'react';
import { LogoMark } from './Logo';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * Boot loader — small node diagram that connects itself, then fades out.
 */
export function LoadingScreen() {
  const [phase, setPhase] = useState<'draw' | 'connected' | 'exit'>('draw');
  const reduced = useReducedMotion();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduced) {
      const t = setTimeout(() => setPhase('exit'), 0);
      return () => clearTimeout(t);
    }
    timer.current = setTimeout(() => setPhase('connected'), 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [reduced]);

  useEffect(() => {
    if (phase !== 'connected') return;
    timer.current = setTimeout(() => setPhase('exit'), 350);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [phase]);

  return (
    <div
      data-phase={phase}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-paper transition-opacity duration-300 data-[phase=exit]:pointer-events-none data-[phase=exit]:opacity-0"
      aria-label="Loading VisualBoard"
    >
      <div className="flex flex-col items-center gap-6">
        <svg width="120" height="36" viewBox="0 0 120 36" fill="none" aria-hidden="true">
          <g stroke="#1b1a17" strokeWidth="1.6" opacity="0.35">
            <line className="ld-line-1" x1="14" y1="18" x2="34" y2="18" />
            <line className="ld-line-2" x1="34" y1="18" x2="62" y2="18" />
            <line className="ld-line-3" x1="62" y1="18" x2="62" y2="6" />
            <line className="ld-line-4" x1="62" y1="7" x2="82" y2="7" opacity="0" />
          </g>
          <circle cx="14" cy="18" r="5" fill="#1b1a17" className="ld-node ld-node-1" />
          <circle cx="34" cy="18" r="4" fill="#1b1a17" className="ld-node ld-node-2" />
          <circle cx="62" cy="18" r="4.5" fill="#1b1a17" className="ld-node ld-node-3" />
          <circle cx="62" cy="6" r="3.5" fill="#d9480f" className="ld-node ld-node-4" />
          <circle cx="82" cy="7" r="3" fill="#1b1a17" opacity="0" className="ld-node ld-node-5" />
          <circle cx="106" cy="28" r="4.5" fill="#1b1a17" className="ld-node ld-node-6" />
          <line className="ld-line-5" x1="62" y1="18" x2="106" y2="28" />
          <line className="ld-line-6" x1="82" y1="7" x2="106" y2="28" />
        </svg>

        <div className="flex items-center gap-2.5">
          <LogoMark size={18} />
          <span className="text-[15px] font-semibold tracking-tight text-ink">
            VisualBoard
          </span>
          <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
            loading
          </span>
        </div>
      </div>

      <style>{`
        .ld-node { transform-origin: center; }
        .ld-node-1 { animation: ld-pop 0.3s ease-out both; }
        .ld-node-2 { animation: ld-pop 0.3s 0.08s ease-out both; }
        .ld-node-3 { animation: ld-pop 0.3s 0.16s ease-out both; }
        .ld-node-4 { animation: ld-pop 0.3s 0.24s ease-out both; }
        .ld-node-6 { animation: ld-pop 0.3s 0.32s ease-out both; }
        .ld-node-5 { animation: ld-pop 0.3s 0.42s ease-out both; }
        .ld-line-1 { stroke-dasharray: 20; stroke-dashoffset: 20; animation: ld-line 0.3s 0.1s linear forwards; }
        .ld-line-2 { stroke-dasharray: 28; stroke-dashoffset: 28; animation: ld-line 0.3s 0.22s linear forwards; }
        .ld-line-3 { stroke-dasharray: 12; stroke-dashoffset: 12; animation: ld-line 0.3s 0.3s linear forwards; }
        .ld-line-4 { stroke-dasharray: 20; stroke-dashoffset: 20; animation: ld-line 0.3s 0.42s linear forwards; }
        .ld-line-5 { stroke-dasharray: 46; stroke-dashoffset: 46; animation: ld-line 0.35s 0.38s linear forwards; }
        .ld-line-6 { stroke-dasharray: 30; stroke-dashoffset: 30; animation: ld-line 0.35s 0.5s linear forwards; }
        @keyframes ld-pop { from { opacity: 0; transform: scale(0.6); } to { opacity: 1; transform: scale(1); } }
        @keyframes ld-line { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .ld-node, .ld-line { animation: none !important; }
          .ld-node-4, .ld-node-5 { opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}