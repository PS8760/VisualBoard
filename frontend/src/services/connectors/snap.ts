import type { BoardElement } from '../../types';
import { bindableAt, type Pt } from '../geometry';
import type { Anchor, Side } from './model';
import { anchorPoints, type Scene } from './route';

export interface SnapResult {
  elementId?: string;
  anchor: Anchor;
  point: Pt;
  /** Snapped cardinal anchor, for feedback. */
  side?: Side;
}

/**
 * Magnetic snapping for connector ends. Over a shape (with a small halo of
 * tolerance) the end attaches to it; within `anchorRadius` of a side's
 * anchor dot it locks to that side (fixed anchor), otherwise it floats.
 */
export function snapEnd(
  point: Pt,
  elements: BoardElement[],
  scene: Scene,
  opts: { zoom?: number; exclude?: string; disabled?: boolean } = {},
): SnapResult {
  if (opts.disabled) return { anchor: { type: 'auto' }, point };
  const zoom = opts.zoom ?? 1;
  const target = bindableAt(elements, point, 16 / zoom, opts.exclude);
  if (!target) return { anchor: { type: 'auto' }, point };
  const shape = scene.shape(target.id);
  if (!shape) return { anchor: { type: 'auto' }, point };
  const anchorRadius = 18 / zoom;
  let best: { side: Side; d: number } | null = null;
  for (const a of anchorPoints(shape)) {
    const d = Math.hypot(a.point.x - point.x, a.point.y - point.y);
    if (d <= anchorRadius && (!best || d < best.d)) best = { side: a.side, d };
  }
  if (best) return { elementId: target.id, anchor: { type: 'side', side: best.side }, point, side: best.side };
  return { elementId: target.id, anchor: { type: 'auto' }, point };
}
