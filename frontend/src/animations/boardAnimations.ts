import gsap from 'gsap';
import type { FabricObject } from 'fabric';

const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface FabricTarget {
  object: FabricObject | null;
  x?: number;
  y?: number;
  points?: number[];
  rotation?: number;
}

/** Smoothly animates fabric objects toward arranged positions (Level 3, ~900ms). */
export function animateArrangement(
  targets: FabricTarget[],
  onComplete?: () => void,
  onProgress?: (completed: number) => void,
) {
  if (REDUCED) {
    targets.forEach((t) => {
      if (!t.object) return;
      if (t.x !== undefined) t.object.set('left', t.x);
      if (t.y !== undefined) t.object.set('top', t.y);
      if (t.points) t.object.set('points', t.points);
    });
    onProgress?.(1);
    onComplete?.();
    return () => {};
  }

  let completed = 0;
  const total = targets.length;

  const finish = () => {
    if (++completed === total) {
      onProgress?.(1);
      onComplete?.();
    }
  };

  const tweens = targets.map((t) => {
    const obj = t.object;
    if (!obj) {
      finish();
      return null;
    }
    const vars: gsap.TweenVars = {
      duration: 0.85,
      ease: 'power3.inOut',
      onComplete: finish,
      onUpdate: () => {
        if (!onProgress) return;
        obj.setCoords();
        onProgress(completed / total + (gsap.getProperty(obj, 'left') as number) * 0);
        obj.canvas?.requestRenderAll();
      },
    };
    if (t.x !== undefined) vars.left = t.x;
    if (t.y !== undefined) vars.top = t.y;
    if (t.points) vars.points = t.points;
    if (t.rotation !== undefined) vars.angle = t.rotation;
    return gsap.to(obj, vars);
  });

  return () => tweens.filter(Boolean).forEach((t) => t?.kill());
}

/** Draws a connector path onto a fabric object (dash-sweep effect). */
export function animateConnectorDraw(object: FabricObject, duration = 0.7) {
  if (REDUCED) return () => {};
  object.set({ opacity: 0.1 });
  return gsap.to(object, { opacity: 1, duration, ease: 'power1.out' });
}

/** Subtle pulse for the completion indicator after arranging. */
export function completionPulse(element: HTMLElement | null) {
  if (!element) return () => {};
  const tl = gsap.timeline();
  tl.fromTo(
    element,
    { opacity: 0, scale: 0.9, y: 6 },
    { opacity: 1, scale: 1, y: 0, duration: 0.35, ease: 'back.out(2)' },
  )
    .to(element, { opacity: 0, scale: 0.96, y: -6, duration: 0.4, delay: 1.4, ease: 'power2.in' });
  return () => tl.kill();
}
