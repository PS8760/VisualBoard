import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Hero from './Hero';
import Problem from './Problem';
import Modes from './Modes';
import Showcase from './Showcase';
import Collaboration from './Collaboration';
import Documentation from './Documentation';
import VersionHistory from './VersionHistory';
import Architecture from './Architecture';
import CTA from './CTA';
import Footer from './Footer';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';
import { revealContainer } from '../../animations/scrollAnimations';

export default function Home() {
  const { pathname } = useLocation();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useSmoothScroll(true);

  useEffect(() => {
    return revealContainer(rootRef.current);
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-paper text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-sm focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <Navbar />
      <main id="main">
        <Hero />
        <Problem />
        <Modes />
        <Showcase />
        <Collaboration />
        <Documentation />
        <VersionHistory />
        <Architecture />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}