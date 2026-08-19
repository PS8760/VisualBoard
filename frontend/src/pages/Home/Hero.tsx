import { Link } from 'react-router-dom';
import { ArrowRight, MousePointer2, Pencil } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Container } from '../../components/ui/Section';
import HeroCanvas from './HeroCanvas';

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden pt-28 md:pt-36"
      aria-label="VisualBoard introduction"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-60"
        style={{
          background:
            'radial-gradient(58% 60% at 50% 0%, rgba(217,72,15,0.055) 0%, transparent 100%)',
        }}
        aria-hidden="true"
      />
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.18fr] lg:gap-12">
          <div>
            <p className="hero-fade hero-fade-1 mono-label mb-5 inline-flex items-center gap-2.5 rounded-full border border-line bg-paper-2/60 px-3.5 py-1.5 text-ink-2">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              THINK · SKETCH · STRUCTURE · COLLABORATE
            </p>

            <h1 className="hero-fade hero-fade-2 text-balance text-[42px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl md:text-[68px]">
              Think visually.
              <br />
              Build together.
            </h1>

            <p className="hero-fade hero-fade-3 text-pretty mt-6 max-w-lg text-[16px] leading-relaxed text-ink-2 md:text-[17px]">
              A collaborative whiteboard for ideas, system architecture,
              documentation, and everything in between. Sketch freely — the
              canvas keeps the structure for you.
            </p>

            <div className="hero-fade hero-fade-4 mt-8 flex flex-wrap items-center gap-3">
              <Link to="/register">
                <Button size="lg" className="group">
                  Start Creating
                  <ArrowRight
                    size={15}
                    strokeWidth={2.2}
                    className="transition-transform duration-150 group-hover:translate-x-0.5"
                  />
                </Button>
              </Link>
              <a href="#product">
                <Button size="lg" variant="secondary" icon={<MousePointer2 size={15} />}>
                  Explore the Workspace
                </Button>
              </a>
            </div>

            <div className="hero-fade hero-fade-5 mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[11px] tracking-wide text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <MousePointer2 size={12} /> Infinite canvas
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Pencil size={12} /> Real-time sync
              </span>
              <span className="inline-flex items-center gap-1.5">
                <kbd className="rounded-sm border border-line-2 bg-paper px-1.5 py-0.5 text-[10px] text-ink-2">⌘K</kbd>
                Command palette
              </span>
            </div>
          </div>

          <div className="hero-fade hero-fade-6 relative">
            <HeroCanvas />
          </div>
        </div>
      </Container>

      <style>{`
        .hero-fade { opacity: 0; animation: hero-fade 0.6s cubic-bezier(0.22,1,0.36,1) forwards; }
        .hero-fade-1 { animation-delay: 0.05s; }
        .hero-fade-2 { animation-delay: 0.15s; }
        .hero-fade-3 { animation-delay: 0.25s; }
        .hero-fade-4 { animation-delay: 0.35s; }
        .hero-fade-5 { animation-delay: 0.45s; }
        .hero-fade-6 { animation-delay: 0.5s; }
        @keyframes hero-fade { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .hero-fade { opacity: 1 !important; animation: none !important; }
        }
      `}</style>
    </section>
  );
}