import gsap from 'gsap';

/**
 * Small reusable interaction tweens (Level 1, 150–250ms).
 * Most micro-interactions live in CSS; these handle the ones that can't.
 */

export function pressIn(element: HTMLElement | null) {
  if (!element) return () => {};
  const tween = gsap.fromTo(
    element,
    { scale: 0.98 },
    { scale: 1, duration: 0.25, ease: 'power2.out', clearProps: 'scale' },
  );
  return () => tween.kill();
}

export function popIn(element: HTMLElement | null) {
  if (!element) return () => {};
  const tween = gsap.fromTo(
    element,
    { opacity: 0, scale: 0.95, y: 4 },
    { opacity: 1, scale: 1, y: 0, duration: 0.22, ease: 'back.out(2.5)' },
  );
  return () => tween.kill();
}

export function fadeSlideIn(element: HTMLElement | null, fromY = 8) {
  if (!element) return () => {};
  const tween = gsap.fromTo(
    element,
    { opacity: 0, y: fromY },
    { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' },
  );
  return () => tween.kill();
}
