import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Reveals all [data-reveal] elements inside a container as they enter the
 * viewport. Child elements with a [data-reveal-delay] attribute are staggered.
 * Honors prefers-reduced-motion.
 */
export function revealContainer(container: HTMLElement | null, options?: { distance?: number }) {
  if (!container) return () => {};
  const distance = options?.distance ?? 18;
  const items = container.querySelectorAll<HTMLElement>('[data-reveal]');
  if (!items.length || REDUCED) {
    items.forEach((el) => el.removeAttribute('style'));
    return () => {};
  }

  const triggers: ScrollTrigger[] = [];
  items.forEach((el) => {
    const delay = parseFloat(el.dataset.revealDelay ?? '0');
    const tween = gsap.fromTo(
      el,
      { opacity: 0, y: distance },
      {
        opacity: 1,
        y: 0,
        duration: 0.65,
        delay,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      },
    );
    triggers.push(tween.scrollTrigger as ScrollTrigger);
  });

  return () => {
    triggers.forEach((st) => st?.kill());
  };
}

/**
 * Scrolls a section's counter/mono-label in when the section is 60% visible.
 */
export function activateOnScroll(container: HTMLElement | null, selector: string, className: string) {
  if (!container) return () => {};
  const el = container.querySelector(selector);
  if (!el) return () => {};

  const trigger = ScrollTrigger.create({
    trigger: container,
    start: 'top 62%',
    once: true,
    onEnter: () => el.classList.add(className),
  });

  return () => trigger.kill();
}

/** Draws SVG path lines (e.g. architecture connectors) on scroll. */
export function drawPathsOnScroll(container: HTMLElement | null, paths: SVGPathElement[]) {
  if (!paths.length) return () => {};
  if (REDUCED) {
    paths.forEach((p) => {
      p.style.strokeDasharray = 'none';
      p.style.opacity = '1';
    });
    return () => {};
  }

  const tweens = paths.map((path) => {
    const length = path.getTotalLength();
    gsap.set(path, { strokeDasharray: length, strokeDashoffset: length, opacity: 1 });
    return gsap.to(path, {
      strokeDashoffset: 0,
      duration: 1.4,
      ease: 'power2.inOut',
      scrollTrigger: { trigger: container ?? path, start: 'top 80%', once: true },
    });
  });

  return () => {
    tweens.forEach((t) => t.kill());
  };
}
