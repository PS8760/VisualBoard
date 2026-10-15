import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { ArrowRight } from 'lucide-react';
import { Container } from '../../components/ui/Section';
import { useReveal } from '../../hooks/useReveal';

export default function CTA() {
  const ref = useReveal<HTMLElement>();
  const isAuth = useAuthStore((s) => Boolean(s.user));

  return (
    <section ref={ref} className="border-t border-line bg-paper">
      <Container className="py-24 md:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <p data-reveal className="mono-label mb-4 text-ink-3">
            FREE TO START · NO CREDIT CARD
          </p>
          <h2 data-reveal className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-ink md:text-6xl">
            Your next idea deserves a canvas.
          </h2>
          <p data-reveal className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
            Open a board, sketch the mess, and let the structure come out of it.
          </p>
          <div data-reveal className="mt-9 flex justify-center">
            <Link
              to={isAuth ? '/dashboard' : '/register'}
              className="group inline-flex h-11 items-center gap-2 rounded-sm bg-ink px-7 text-[14.5px] font-medium text-paper shadow-sm transition-all duration-150 hover:bg-ink-hover active:scale-[0.98]"
            >
              Create a Board
              <ArrowRight
                size={16}
                className="transition-transform duration-150 group-hover:translate-x-0.5"
              />
            </Link>
          </div>
          <p data-reveal className="mt-5 font-mono text-[11px] text-ink-3">
            /board/your-idea — ready in seconds
          </p>
        </div>
      </Container>
    </section>
  );
}