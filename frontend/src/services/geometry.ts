import type { BoardElement } from '../types';

/**
 * Pure geometry for the canvas: element bounds, connector anchoring, smart
 * alignment guides, ink → shape recognition and z-ordering. No fabric or DOM
 * dependencies, so it is unit-tested directly.
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** Axis-aligned world bounds of an element (rotation ignored except for lines). */
export function elementBox(el: BoardElement): Box {
  if ((el.kind === 'line' || el.kind === 'arrow') && el.points && el.points.length >= 4 && el.pointsAbsolute) {
    const [x1, y1, x2, y2] = el.points as [number, number, number, number];
    return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  }
  return { x: el.x, y: el.y, w: el.width * (el.scaleX ?? 1), h: el.height * (el.scaleY ?? 1) };
}

export const center = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export function unionBox(boxes: Box[]): Box | null {
  if (!boxes.length) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map((b) => b.x + b.w));
  const btm = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: r - x, h: btm - y };
}

export const contains = (b: Box, p: Pt, pad = 0) =>
  p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad;

/** Kinds a connector can attach to. */
export const BINDABLE = new Set<BoardElement['kind']>(['rect', 'circle', 'sticky', 'document', 'image', 'text']);

/** Topmost bindable element under a point (elements are in stacking order). */
export function bindableAt(elements: BoardElement[], p: Pt, pad = 4, exclude?: string): BoardElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i]!;
    if (el.id === exclude || !BINDABLE.has(el.kind)) continue;
    if (contains(elementBox(el), p, pad)) return el;
  }
  return null;
}

/* ------------------------------------------------------------------------ */
/* Smart guides                                                             */
/* ------------------------------------------------------------------------ */

export interface Guide {
  axis: 'x' | 'y';
  /** World coordinate of the guide line. */
  at: number;
  /** Extent of the guide along the other axis. */
  from: number;
  to: number;
}

/**
 * Snaps a moving box to the edges/centers of nearby boxes. Returns the offset
 * to apply and the guide lines to draw. `threshold` is in world units.
 */
export function computeSnap(moving: Box, others: Box[], threshold: number): { dx: number; dy: number; guides: Guide[] } {
  const xs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const ys = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  let bestX: { d: number; at: number; box: Box } | null = null;
  let bestY: { d: number; at: number; box: Box } | null = null;

  for (const o of others) {
    const oxs = [o.x, o.x + o.w / 2, o.x + o.w];
    const oys = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const mx of xs) {
      for (const ox of oxs) {
        const d = ox - mx;
        if (Math.abs(d) <= threshold && (!bestX || Math.abs(d) < Math.abs(bestX.d))) bestX = { d, at: ox, box: o };
      }
    }
    for (const my of ys) {
      for (const oy of oys) {
        const d = oy - my;
        if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, at: oy, box: o };
      }
    }
  }

  const dx = bestX?.d ?? 0;
  const dy = bestY?.d ?? 0;
  const snapped = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const guides: Guide[] = [];
  if (bestX) {
    guides.push({
      axis: 'x',
      at: bestX.at,
      from: Math.min(snapped.y, bestX.box.y) - 8,
      to: Math.max(snapped.y + snapped.h, bestX.box.y + bestX.box.h) + 8,
    });
  }
  if (bestY) {
    guides.push({
      axis: 'y',
      at: bestY.at,
      from: Math.min(snapped.x, bestY.box.x) - 8,
      to: Math.max(snapped.x + snapped.w, bestY.box.x + bestY.box.w) + 8,
    });
  }
  return { dx, dy, guides };
}

/* ------------------------------------------------------------------------ */
/* Ink → shape recognition                                                  */
/* ------------------------------------------------------------------------ */

export type Recognized =
  | { kind: 'line'; points: [number, number, number, number] }
  | { kind: 'circle'; box: Box }
  | { kind: 'rect'; box: Box };

const toPts = (flat: number[]): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i]!, y: flat[i + 1]! });
  return pts;
};

function pathLength(pts: Pt[]) {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i]!.x - pts[i - 1]!.x, pts[i]!.y - pts[i - 1]!.y);
  return len;
}

/** Shoelace area of the stroke treated as a closed polygon. */
function polygonArea(pts: Pt[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const q = pts[(i + 1) % pts.length]!;
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a) / 2;
}

/**
 * QuickShape-style recognition of a freehand stroke (flat [x,y,…] list).
 * Returns null when the stroke doesn't clearly read as a line, circle or
 * rectangle — the ink is then kept as drawn.
 */
export function recognizeStroke(flat: number[]): Recognized | null {
  const pts = toPts(flat);
  if (pts.length < 4) return null;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const len = pathLength(pts);
  if (len < 24) return null;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const box: Box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const diag = Math.hypot(box.w, box.h);
  const gap = Math.hypot(last.x - first.x, last.y - first.y);

  // Open and nearly straight → line.
  if (gap / len > 0.85) return { kind: 'line', points: [first.x, first.y, last.x, last.y] };

  // Closed shapes only from here.
  if (gap > diag * 0.3 || box.w < 16 || box.h < 16) return null;

  const c = center(box);
  const radii = pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
  const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
  const deviation = Math.sqrt(radii.reduce((a, r) => a + (r - mean) ** 2, 0) / radii.length) / mean;
  const fill = polygonArea(pts) / (box.w * box.h); // circle ≈ 0.785, rectangle ≈ 1
  const aspect = Math.min(box.w, box.h) / Math.max(box.w, box.h);

  if (deviation < 0.16 && aspect > 0.7 && fill > 0.62 && fill < 0.88) {
    const side = (box.w + box.h) / 2;
    return { kind: 'circle', box: { x: c.x - side / 2, y: c.y - side / 2, w: side, h: side } };
  }
  if (fill >= 0.84) return { kind: 'rect', box };
  return null;
}

/* ------------------------------------------------------------------------ */
/* Stacking order                                                           */
/* ------------------------------------------------------------------------ */

/** Stable sort by zIndex; elements without one keep their creation order at 0. */
export function sortByZ(elements: BoardElement[]): BoardElement[] {
  if (!elements.some((el) => el.zIndex)) return elements;
  return elements
    .map((el, i) => ({ el, i }))
    .sort((a, b) => (a.el.zIndex ?? 0) - (b.el.zIndex ?? 0) || a.i - b.i)
    .map(({ el }) => el);
}
