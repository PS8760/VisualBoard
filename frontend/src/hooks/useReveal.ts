import { useEffect, useRef } from 'react';
import { revealContainer } from '../animations/scrollAnimations';

/** Reveals [data-reveal] children of the returned ref when they scroll into view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    return revealContainer(container);
  }, []);

  return ref;
}
