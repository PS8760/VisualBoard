import { useBoardStore } from '../stores/useBoardStore';
import { useCanvasStore } from '../stores/useCanvasStore';
import { elementBox, unionBox } from './geometry';

/** Frames all board content (animated). */
export function fitToContent() {
  const elements = useBoardStore.getState().board?.elements ?? [];
  useCanvasStore.getState().fitBox(unionBox(elements.map(elementBox)), { animate: true });
}

/** Animated zoom keeping the screen center fixed. */
export function zoomAroundCenter(scale: number) {
  const { container, viewport, animateTo } = useCanvasStore.getState();
  if (!container) return;
  const cx = container.clientWidth / 2;
  const cy = container.clientHeight / 2;
  const next = Math.min(4, Math.max(0.1, scale));
  const wx = (cx - viewport.x) / viewport.scale;
  const wy = (cy - viewport.y) / viewport.scale;
  animateTo({ scale: next, x: cx - wx * next, y: cy - wy * next }, 200);
}
