import gsap from 'gsap';
import type { MutableRefObject } from 'react';

export interface HeroCanvasRefs {
  nodes: MutableRefObject<(HTMLDivElement | null)[]>;
  connectors: MutableRefObject<(SVGLineElement | null)[]>;
  note: MutableRefObject<HTMLDivElement | null>;
  docChip: MutableRefObject<HTMLDivElement | null>;
  commentBubble: MutableRefObject<HTMLDivElement | null>;
  cursor: MutableRefObject<HTMLDivElement | null>;
  cursorLabel: MutableRefObject<HTMLDivElement | null>;
  arrangePulse: MutableRefObject<HTMLDivElement | null>;
}

/** Entrance sequence for the hero mini-canvas (Level 3, 1200ms). */
export function heroEntranceTimeline(refs: HeroCanvasRefs) {
  const { nodes, connectors, note, docChip, commentBubble, cursor, cursorLabel } = refs;

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  tl.set([...nodes.current.filter(Boolean), note.current, docChip.current, commentBubble.current], {
    opacity: 0,
    scale: 0.92,
  })
    .fromTo(connectors.current.filter(Boolean), { opacity: 0 }, { opacity: 1, duration: 0.3, stagger: 0.08 })
    .to(nodes.current[0], { opacity: 1, scale: 1, duration: 0.35 }, 0.1)
    .to(nodes.current[1], { opacity: 1, scale: 1, duration: 0.35 }, 0.18)
    .to(nodes.current[2], { opacity: 1, scale: 1, duration: 0.35 }, 0.26)
    .to(nodes.current[3], { opacity: 1, scale: 1, duration: 0.35 }, 0.34)
    .to(nodes.current[4], { opacity: 1, scale: 1, duration: 0.35 }, 0.42)
    .to(nodes.current[5], { opacity: 1, scale: 1, duration: 0.35 }, 0.5)
    .to(note.current, { opacity: 1, scale: 1, duration: 0.4 }, 0.55)
    .to(docChip.current, { opacity: 1, scale: 1, duration: 0.4 }, 0.68)
    .to(commentBubble.current, { opacity: 1, scale: 1, duration: 0.4 }, 0.76)
    .fromTo(cursor.current, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0.9)
    .fromTo(cursorLabel.current, { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.25 }, 0.95);

  return tl;
}

/** Continuous gentle drift after the entrance settles. */
export function heroAmbientLoop(refs: HeroCanvasRefs, reducedMotion: boolean) {
  if (reducedMotion) return () => {};
  const { nodes, cursor, arrangePulse } = refs;

  const tween = gsap.timeline({ repeat: -1, repeatDelay: 1.2, ease: 'sine.inOut' });

  tween
    .to(cursor.current, { x: 46, y: 30, duration: 1.6 }, 0.4)
    .to(cursor.current, { x: 0, y: 0, duration: 1.4 }, 2.2)
    .to(arrangePulse.current, { opacity: 1, scale: 1.15, duration: 0.5 }, 3.6)
    .to(arrangePulse.current, { opacity: 0, scale: 1, duration: 0.5 }, 4.3)
    .to(nodes.current[2], { y: -2, duration: 1.6 }, 4.4)
    .to(nodes.current[2], { y: 0, duration: 1.6 }, 6.2);

  return () => tween.kill();
}
