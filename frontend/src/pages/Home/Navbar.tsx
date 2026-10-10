import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../../components/ui/Logo';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { useAuthStore } from '../../stores/useAuthStore';
import { cn } from '../../utils';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';

const NAV_LINKS = [
  { label: 'Product', href: '#product' },
  { label: 'Features', href: '#features' },
  { label: 'Collaboration', href: '#collaboration' },
  { label: 'Documentation', href: '#documentation' },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useSmoothScroll(!menuOpen);

  return (
    <header
      className={cn(
        'nav-drop fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-line bg-paper/85 backdrop-blur-md shadow-xs'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <nav
        className={cn(
          'mx-auto flex max-w-[1200px] items-center justify-between px-5 transition-all duration-300 md:px-8',
          scrolled ? 'h-14' : 'h-16 md:h-[72px]',
        )}
        aria-label="Primary"
      >
        <Link to="/" className="shrink-0" aria-label="VisualBoard home">
          <Logo size={scrolled ? 'sm' : 'md'} />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="group relative rounded-md px-3 py-1.5 text-[13.5px] font-medium text-ink-2 transition-colors duration-150 hover:text-ink"
            >
              {link.label}
              <span className="absolute inset-x-3 -bottom-0.5 h-px scale-x-0 bg-ink transition-transform duration-200 group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {useAuthStore((s) => Boolean(s.user)) ? (
            <>
              <Link to="/dashboard" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="font-medium">
                  Dashboard
                </Button>
              </Link>
              <Link to="/profile">
                <Button size="sm" className="font-medium">
                  Profile
                </Button>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="font-medium">
                  Login
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="font-medium">
                  Get Started
                </Button>
              </Link>
            </>
          )}
          <ThemeToggle size="sm" className="ml-1 hidden md:flex" />
          <button
            className="ml-1 flex h-8 w-8 items-center justify-center rounded-md border border-line text-ink-2 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="Toggle navigation menu"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              ) : (
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen && (
      <div className="border-b border-line bg-paper px-5 pb-4 pt-2 md:hidden">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-ink-2 hover:bg-paper-2 hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <div className="mt-2 flex items-center gap-2">
            <Link to="/login" onClick={() => setMenuOpen(false)} className="flex-1">
              <Button variant="secondary" size="sm" className="w-full">
                Login
              </Button>
            </Link>
            <ThemeToggle size="sm" />
          </div>
        </div>
      )}

      <style>{`
        .nav-drop { opacity: 0; animation: nav-drop 0.5s cubic-bezier(0.22,1,0.36,1) 0.05s forwards; }
        @keyframes nav-drop { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .nav-drop { opacity: 1 !important; animation: none !important; }
        }
      `}</style>
    </header>
  );
}