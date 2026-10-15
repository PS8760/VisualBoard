import type { BoardElement } from '../../types';
import { BINDABLE, elementBox, type Box, type Pt } from '../geometry';
import type { Anchor, ConnectorEnd, ConnectorModel, Side } from './model';

/**
 * Connector routing engine (pure geometry).
 *
 *  - Perimeter anchoring: exact outline intersection for rectangles (ray/box)
 *    and circles, floating ("auto") or fixed (side midpoint / custom point).
 *  - Straight polylines through user waypoints.
 *  - Cubic Béziers whose control vectors follow the anchor sides' surface
 *    normals (Catmull-Rom → Bézier through waypoints).
 *  - Orthogonal (Manhattan) routes: A* over a sparse orthogonal visibility
 *    grid built from padded obstacle edges, with a bend penalty, then filleted.
 *  - Self-loops for connectors that start and end on the same shape.
 */

/* ------------------------------------------------------------------------ */
/* Scene                                                                    */
/* ------------------------------------------------------------------------ */

export interface SceneShape {
  id: string;
  kind: BoardElement['kind'];
  box: Box;
}

export interface Scene {
  shape(id: string | undefined): SceneShape | undefined;
  /** Boxes of shapes intersecting `region`, minus `exclude`. */
  obstacles(region: Box, exclude?: Set<string>): Box[];
}

export function sceneFrom(elements: BoardElement[], overrides?: Map<string, Box>): Scene {
  const shapes = new Map<string, SceneShape>();
  for (const el of elements) {
    if (!BINDABLE.has(el.kind)) continue;
    shapes.set(el.id, { id: el.id, kind: el.kind, box: overrides?.get(el.id) ?? elementBox(el) });
  }
  return {
    shape: (id) => (id ? shapes.get(id) : undefined),
    obstacles: (region, exclude) => {
      const out: Box[] = [];
      for (const s of shapes.values()) {
        if (exclude?.has(s.id)) continue;
        const b = s.box;
        if (b.x > region.x + region.w || b.x + b.w < region.x || b.y > region.y + region.h || b.y + b.h < region.y) continue;
        out.push(b);
      }
      return out;
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Vector helpers                                                           */
/* ------------------------------------------------------------------------ */

const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a: Pt, k: number): Pt => ({ x: a.x * k, y: a.y * k });
const len = (a: Pt) => Math.hypot(a.x, a.y);
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const norm = (a: Pt): Pt => {
  const l = len(a);
  return l < 1e-9 ? { x: 1, y: 0 } : { x: a.x / l, y: a.y / l };
};
const centerOf = (b: Box): Pt => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

export const SIDE_NORMAL: Record<Side, Pt> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** Side midpoint of a box. */
export function sidePoint(b: Box, side: Side): Pt {
  switch (side) {
    case 'top':
      return { x: b.x + b.w / 2, y: b.y };
    case 'bottom':
      return { x: b.x + b.w / 2, y: b.y + b.h };
    case 'left':
      return { x: b.x, y: b.y + b.h / 2 };
    case 'right':
      return { x: b.x + b.w, y: b.y + b.h / 2 };
  }
}

/**
 * Side of `b` that faces the target. With a target box, decide by the actual
 * gap between the shapes (wide boxes side by side connect left↔right even
 * when vertically offset); otherwise by direction to the point.
 */
export function facingSide(b: Box, p: Pt, target?: Box): Side {
  const c = centerOf(b);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  if (target) {
    const hgap = Math.max(target.x - (b.x + b.w), b.x - (target.x + target.w));
    const vgap = Math.max(target.y - (b.y + b.h), b.y - (target.y + target.h));
    if (hgap > 0 || vgap > 0) {
      return hgap >= vgap ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
    }
  }
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top';
}

/* ------------------------------------------------------------------------ */
/* End resolution                                                           */
/* ------------------------------------------------------------------------ */

/** Gap between an outline and the connector tip, so markers sit just outside. */
const GAP = 3;

export interface ResolvedEnd {
  point: Pt;
  /** Unit outward normal of the outline at the anchor (null for free ends). */
  normal: Pt | null;
  shape?: SceneShape;
}

function circleEnd(s: SceneShape, anchor: Anchor, aim: Pt): ResolvedEnd {
  const c = centerOf(s.box);
  const r = Math.min(s.box.w, s.box.h) / 2;
  let dir: Pt;
  if (anchor.type === 'side') dir = SIDE_NORMAL[anchor.side];
  else if (anchor.type === 'point') dir = norm({ x: anchor.nx - 0.5, y: anchor.ny - 0.5 });
  else dir = norm(sub(aim, c));
  return { point: add(c, mul(dir, r + GAP)), normal: dir, shape: s };
}

function rectEnd(s: SceneShape, anchor: Anchor, aim: Pt, routing: ConnectorModel['routing'], aimBox?: Box): ResolvedEnd {
  const b = s.box;
  if (anchor.type === 'side') {
    const n = SIDE_NORMAL[anchor.side];
    return { point: add(sidePoint(b, anchor.side), mul(n, GAP)), normal: n, shape: s };
  }
  if (anchor.type === 'point') {
    // Project the normalized point onto the nearest side.
    const px = b.x + anchor.nx * b.w;
    const py = b.y + anchor.ny * b.h;
    const d = { left: px - b.x, right: b.x + b.w - px, top: py - b.y, bottom: b.y + b.h - py };
    const side = (Object.keys(d) as Side[]).reduce((m, k) => (d[k] < d[m] ? k : m), 'left');
    const n = SIDE_NORMAL[side];
    const onSide =
      side === 'left' || side === 'right'
        ? { x: side === 'left' ? b.x : b.x + b.w, y: py }
        : { x: px, y: side === 'top' ? b.y : b.y + b.h };
    return { point: add(onSide, mul(n, GAP)), normal: n, shape: s };
  }
  // Floating: orthogonal routes leave from the facing side's midpoint; free
  // routes hit the outline exactly where the ray to the target crosses it.
  if (routing === 'elbow') {
    const side = facingSide(b, aim, aimBox);
    const n = SIDE_NORMAL[side];
    return { point: add(sidePoint(b, side), mul(n, GAP)), normal: n, shape: s };
  }
  const c = centerOf(b);
  const d = norm(sub(aim, c));
  const tx = Math.abs(d.x) > 1e-9 ? b.w / 2 / Math.abs(d.x) : Infinity;
  const ty = Math.abs(d.y) > 1e-9 ? b.h / 2 / Math.abs(d.y) : Infinity;
  const t = Math.min(tx, ty);
  const hit = add(c, mul(d, t));
  const n = tx < ty ? (d.x > 0 ? SIDE_NORMAL.right : SIDE_NORMAL.left) : d.y > 0 ? SIDE_NORMAL.bottom : SIDE_NORMAL.top;
  return { point: add(hit, mul(d, GAP)), normal: n, shape: s };
}

export function resolveEnd(end: ConnectorEnd, aim: Pt, routing: ConnectorModel['routing'], scene: Scene, aimBox?: Box): ResolvedEnd {
  const s = scene.shape(end.elementId);
  if (!s) return { point: end.point, normal: null };
  return s.kind === 'circle' ? circleEnd(s, end.anchor, aim) : rectEnd(s, end.anchor, aim, routing, aimBox);
}

/** Both resolved ends, each aiming at what lies next along the path. */
export function resolveEnds(model: ConnectorModel, scene: Scene): { start: ResolvedEnd; end: ResolvedEnd } {
  const startShape = scene.shape(model.start.elementId);
  const endShape = scene.shape(model.end.elementId);
  const startRef = endShape ? centerOf(endShape.box) : model.end.point;
  const endRef = startShape ? centerOf(startShape.box) : model.start.point;
  const wp = model.waypoints;
  const startAim = model.routing !== 'elbow' && wp.length ? wp[0]! : startRef;
  const endAim = model.routing !== 'elbow' && wp.length ? wp[wp.length - 1]! : endRef;
  const useBoxes = model.routing === 'elbow' || !wp.length;
  return {
    start: resolveEnd(model.start, startAim, model.routing, scene, useBoxes ? endShape?.box : undefined),
    end: resolveEnd(model.end, endAim, model.routing, scene, useBoxes ? startShape?.box : undefined),
  };
}

/* ------------------------------------------------------------------------ */
/* Path representation                                                      */
/* ------------------------------------------------------------------------ */

export type Seg =
  | { type: 'L'; to: Pt }
  | { type: 'Q'; c: Pt; to: Pt }
  | { type: 'C'; c1: Pt; c2: Pt; to: Pt };

export interface ConnectorPath {
  start: Pt;
  end: Pt;
  segs: Seg[];
  /** Flattened polyline, with the index of the user span each vertex belongs to. */
  poly: Pt[];
  polySpan: number[];
  /** Unit direction of travel arriving at each tip (for markers). */
  startDir: Pt;
  endDir: Pt;
  bbox: Box;
  length: number;
  selfLoop: boolean;
}

function flatten(start: Pt, segs: Seg[], spanOf: (segIndex: number) => number) {
  const poly: Pt[] = [start];
  const polySpan: number[] = [spanOf(0)];
  let p = start;
  segs.forEach((seg, i) => {
    const span = spanOf(i);
    if (seg.type === 'L') {
      poly.push(seg.to);
      polySpan.push(span);
    } else if (seg.type === 'Q') {
      for (let k = 1; k <= 10; k++) {
        const t = k / 10;
        const u = 1 - t;
        poly.push({ x: u * u * p.x + 2 * u * t * seg.c.x + t * t * seg.to.x, y: u * u * p.y + 2 * u * t * seg.c.y + t * t * seg.to.y });
        polySpan.push(span);
      }
    } else {
      for (let k = 1; k <= 20; k++) {
        const t = k / 20;
        const u = 1 - t;
        poly.push({
          x: u * u * u * p.x + 3 * u * u * t * seg.c1.x + 3 * u * t * t * seg.c2.x + t * t * t * seg.to.x,
          y: u * u * u * p.y + 3 * u * u * t * seg.c1.y + 3 * u * t * t * seg.c2.y + t * t * t * seg.to.y,
        });
        polySpan.push(span);
      }
    }
    p = seg.to;
  });
  return { poly, polySpan };
}

function finish(start: Pt, segs: Seg[], spanOf: (i: number) => number, selfLoop = false): ConnectorPath {
  const { poly, polySpan } = flatten(start, segs, spanOf);
  const end = segs.length ? segs[segs.length - 1]!.to : start;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  let length = 0;
  for (let i = 1; i < poly.length; i++) length += dist(poly[i - 1]!, poly[i]!);
  // Tangents from the flattened geometry (robust for every segment type).
  const firstAway = poly.find((p) => dist(p, start) > 0.5) ?? end;
  const lastAway = [...poly].reverse().find((p) => dist(p, end) > 0.5) ?? start;
  return {
    start,
    end,
    segs,
    poly,
    polySpan,
    startDir: norm(sub(start, firstAway)),
    endDir: norm(sub(end, lastAway)),
    bbox: { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) },
    length,
    selfLoop,
  };
}

/* ------------------------------------------------------------------------ */
/* Routing modes                                                            */
/* ------------------------------------------------------------------------ */

function routeStraight(s: Pt, e: Pt, waypoints: Pt[]): ConnectorPath {
  const pts = [...waypoints, e];
  return finish(s, pts.map((to) => ({ type: 'L' as const, to })), (i) => i);
}

/** Cubic curve (or Catmull-Rom spline through waypoints) steered by surface normals. */
function routeCurved(s: ResolvedEnd, e: ResolvedEnd, waypoints: Pt[], bend: number): ConnectorPath {
  const pts = [s.point, ...waypoints, e.point];
  const chord = dist(s.point, e.point);
  const reach = Math.min(240, Math.max(36, chord * 0.42));
  const startN = s.normal ?? norm(sub(pts[1]!, s.point));
  const endN = e.normal ?? norm(sub(pts[pts.length - 2]!, e.point));

  if (!waypoints.length) {
    // Bow perpendicular to the chord (cubic midpoint offset = 3/4 of control offset).
    const perp = norm({ x: -(e.point.y - s.point.y), y: e.point.x - s.point.x });
    const bow = mul(perp, (bend * 4) / 3);
    const c1 = add(add(s.point, mul(startN, reach)), bow);
    const c2 = add(add(e.point, mul(endN, reach)), bow);
    return finish(s.point, [{ type: 'C', c1, c2, to: e.point }], () => 0);
  }

  // Catmull-Rom tangents; ends follow the outline normals.
  const tangents = pts.map((_, i) => {
    if (i === 0) return mul(startN, dist(pts[0]!, pts[1]!));
    if (i === pts.length - 1) return mul(endN, -dist(pts[i]!, pts[i - 1]!));
    return mul(sub(pts[i + 1]!, pts[i - 1]!), 0.5);
  });
  const segs: Seg[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    segs.push({ type: 'C', c1: add(pts[i]!, mul(tangents[i]!, 1 / 3)), c2: sub(pts[i + 1]!, mul(tangents[i + 1]!, 1 / 3)), to: pts[i + 1]! });
  }
  return finish(s.point, segs, (i) => i);
}

/** Loop leaving the right side and returning to the top of the same shape. */
function routeSelfLoop(shape: SceneShape): ConnectorPath {
  const b = shape.box;
  const s = { x: b.x + b.w + GAP, y: b.y + b.h * 0.3 };
  const e = { x: b.x + b.w * 0.7, y: b.y - GAP };
  const r = Math.max(48, Math.min(b.w, b.h) * 0.6);
  return finish(s, [{ type: 'C', c1: { x: s.x + r, y: s.y }, c2: { x: e.x, y: e.y - r }, to: e }], () => 0, true);
}

/* ---------- orthogonal A* ---------- */

const PAD = 18;
const STUB = 24;
const BEND_COST = 36;

interface HeapItem {
  f: number;
  key: string;
}

class MinHeap {
  private items: HeapItem[] = [];
  get size() {
    return this.items.length;
  }
  push(item: HeapItem) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.f <= a[i]!.f) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): HeapItem | undefined {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l]!.f < a[m]!.f) m = l;
        if (r < a.length && a[r]!.f < a[m]!.f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

const DIRS: Pt[] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
];
const dirIndex = (d: Pt | null) => (d ? DIRS.findIndex((v) => Math.abs(v.x - d.x) < 1e-6 && Math.abs(v.y - d.y) < 1e-6) : -1);

/**
 * Orthogonal route from `s` (leaving along `sDir`) to `e` (entering against
 * `eDir`), keeping PAD clearance from `obstacles`. Returns polyline points.
 */
export function orthogonalRoute(s: Pt, sDir: Pt | null, e: Pt, eDir: Pt | null, obstacles: Box[]): Pt[] {
  const s1 = sDir ? add(s, mul(sDir, STUB)) : s;
  const e1 = eDir ? add(e, mul(eDir, STUB)) : e;
  const padded = obstacles.map((b) => ({ x: b.x - PAD, y: b.y - PAD, w: b.w + PAD * 2, h: b.h + PAD * 2 }));

  const uniq = (v: number[]) => [...new Set(v.map((n) => Math.round(n * 100) / 100))].sort((a, b) => a - b);
  const xs = uniq([s1.x, e1.x, (s1.x + e1.x) / 2, ...padded.flatMap((b) => [b.x, b.x + b.w])]);
  const ys = uniq([s1.y, e1.y, (s1.y + e1.y) / 2, ...padded.flatMap((b) => [b.y, b.y + b.h])]);

  const EPS = 0.01;
  const insideAny = (x: number, y: number) =>
    padded.some((b) => x > b.x + EPS && x < b.x + b.w - EPS && y > b.y + EPS && y < b.y + b.h - EPS);
  const segBlocked = (ax: number, ay: number, bx: number, by: number) =>
    padded.some((b) => {
      if (ay === by) {
        if (!(ay > b.y + EPS && ay < b.y + b.h - EPS)) return false;
        return Math.max(ax, bx) > b.x + EPS && Math.min(ax, bx) < b.x + b.w - EPS;
      }
      if (!(ax > b.x + EPS && ax < b.x + b.w - EPS)) return false;
      return Math.max(ay, by) > b.y + EPS && Math.min(ay, by) < b.y + b.h - EPS;
    });

  const xi = (x: number) => xs.indexOf(Math.round(x * 100) / 100);
  const yi = (y: number) => ys.indexOf(Math.round(y * 100) / 100);
  const startXi = xi(s1.x);
  const startYi = yi(s1.y);
  const goalXi = xi(e1.x);
  const goalYi = yi(e1.y);
  const endDirIdx = eDir ? dirIndex(mul(eDir, -1)) : -1;

  const fallback = (): Pt[] => {
    const horizontal = sDir ? Math.abs(sDir.x) > 0 : Math.abs(e1.x - s1.x) >= Math.abs(e1.y - s1.y);
    const mid = horizontal ? [{ x: (s1.x + e1.x) / 2, y: s1.y }, { x: (s1.x + e1.x) / 2, y: e1.y }] : [{ x: s1.x, y: (s1.y + e1.y) / 2 }, { x: e1.x, y: (s1.y + e1.y) / 2 }];
    return simplify([s, s1, ...mid, e1, e]);
  };
  if (startXi < 0 || startYi < 0 || goalXi < 0 || goalYi < 0) return fallback();

  const key = (x: number, y: number, d: number) => `${x},${y},${d}`;
  const g = new Map<string, number>();
  const prev = new Map<string, string>();
  const heap = new MinHeap();
  const startDir = dirIndex(sDir);
  const startKey = key(startXi, startYi, startDir);
  g.set(startKey, 0);
  heap.push({ f: 0, key: startKey });
  const h = (x: number, y: number) => Math.abs(xs[x]! - e1.x) + Math.abs(ys[y]! - e1.y);
  let found: string | null = null;
  let expansions = 0;

  while (heap.size && expansions < 20000) {
    expansions++;
    const { key: cur } = heap.pop()!;
    const [cx, cy, cd] = cur.split(',').map(Number) as [number, number, number];
    if (cx === goalXi && cy === goalYi) {
      found = cur;
      break;
    }
    const gc = g.get(cur)!;
    for (let d = 0; d < 4; d++) {
      if (cd >= 0 && (d + 2) % 4 === cd) continue; // no U-turns
      const nx = cx + (d === 0 ? 1 : d === 2 ? -1 : 0);
      const ny = cy + (d === 1 ? 1 : d === 3 ? -1 : 0);
      if (nx < 0 || ny < 0 || nx >= xs.length || ny >= ys.length) continue;
      const ax = xs[cx]!;
      const ay = ys[cy]!;
      const bx = xs[nx]!;
      const by = ys[ny]!;
      const isGoal = nx === goalXi && ny === goalYi;
      if (!isGoal && insideAny(bx, by)) continue;
      if (segBlocked(ax, ay, bx, by)) continue;
      let cost = gc + Math.abs(bx - ax) + Math.abs(by - ay) + (cd >= 0 && cd !== d ? BEND_COST : 0);
      if (isGoal && endDirIdx >= 0 && d !== endDirIdx) cost += BEND_COST;
      const nk = key(nx, ny, d);
      if (cost < (g.get(nk) ?? Infinity)) {
        g.set(nk, cost);
        prev.set(nk, cur);
        heap.push({ f: cost + h(nx, ny), key: nk });
      }
    }
  }
  if (!found) return fallback();

  const nodes: Pt[] = [];
  for (let k: string | undefined = found; k; k = prev.get(k)) {
    const [x, y] = k.split(',').map(Number) as [number, number];
    nodes.push({ x: xs[x]!, y: ys[y]! });
  }
  nodes.reverse();
  return simplify([s, ...nodes, e]);
}

/** Drops duplicate and collinear points. */
export function simplify(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (out.length && dist(out[out.length - 1]!, p) < 0.5) continue;
    out.push(p);
    while (out.length >= 3) {
      const [a, b, c] = out.slice(-3) as [Pt, Pt, Pt];
      const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
      if (Math.abs(cross) > 0.5) break;
      out.splice(out.length - 2, 1);
    }
  }
  return out;
}

/** Polyline → segments with rounded (filleted) corners. */
function filleted(points: Pt[], radius = 12): Seg[] {
  const segs: Seg[] = [];
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const next = points[i + 1];
    if (!next) {
      segs.push({ type: 'L', to: p });
      break;
    }
    const prev = points[i - 1]!;
    const r = Math.min(radius, dist(prev, p) / 2, dist(p, next) / 2);
    const a = sub(p, mul(norm(sub(p, prev)), r));
    const b = add(p, mul(norm(sub(next, p)), r));
    segs.push({ type: 'L', to: a });
    segs.push({ type: 'Q', c: p, to: b });
  }
  return segs;
}

function routeElbow(s: ResolvedEnd, e: ResolvedEnd, scene: Scene, exclude: Set<string>): ConnectorPath {
  const region = {
    x: Math.min(s.point.x, e.point.x) - 320,
    y: Math.min(s.point.y, e.point.y) - 320,
    w: Math.abs(e.point.x - s.point.x) + 640,
    h: Math.abs(e.point.y - s.point.y) + 640,
  };
  const obstacles = scene.obstacles(region, exclude);
  // The connected shapes are obstacles too (the route must not cut through
  // them); the stubs leave along their normals, outside the padding.
  if (s.shape) obstacles.push(s.shape.box);
  if (e.shape && e.shape !== s.shape) obstacles.push(e.shape.box);
  const pts = orthogonalRoute(s.point, s.normal, e.point, e.normal, obstacles);
  return finish(s.point, filleted(pts), () => 0);
}

/* ------------------------------------------------------------------------ */
/* Public API                                                               */
/* ------------------------------------------------------------------------ */

/** Full path for a connector in the given scene. */
export function computeConnectorPath(model: ConnectorModel, scene: Scene, connectorId?: string): ConnectorPath {
  const startShape = scene.shape(model.start.elementId);
  if (startShape && model.start.elementId === model.end.elementId) return routeSelfLoop(startShape);

  const { start, end } = resolveEnds(model, scene);
  switch (model.routing) {
    case 'elbow': {
      const exclude = new Set<string>([connectorId ?? '', model.start.elementId ?? '', model.end.elementId ?? '']);
      return routeElbow(start, end, scene, exclude);
    }
    case 'curved':
      return routeCurved(start, end, model.waypoints, model.bend);
    default:
      return routeStraight(start.point, end.point, model.waypoints);
  }
}

/** Point and unit tangent at fraction `t` (0..1) of the path's arc length. */
export function pointAt(path: ConnectorPath, t: number): { point: Pt; tangent: Pt } {
  const target = Math.min(1, Math.max(0, t)) * path.length;
  let acc = 0;
  for (let i = 1; i < path.poly.length; i++) {
    const a = path.poly[i - 1]!;
    const b = path.poly[i]!;
    const l = dist(a, b);
    if (acc + l >= target && l > 0) {
      const k = (target - acc) / l;
      return { point: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }, tangent: norm(sub(b, a)) };
    }
    acc += l;
  }
  return { point: path.end, tangent: path.endDir };
}

/** Closest point on the path to `p`: distance, arc fraction and user span. */
export function nearestOnPath(path: ConnectorPath, p: Pt): { point: Pt; distance: number; t: number; span: number } {
  let best = { point: path.start, distance: Infinity, t: 0, span: 0 };
  let acc = 0;
  for (let i = 1; i < path.poly.length; i++) {
    const a = path.poly[i - 1]!;
    const b = path.poly[i]!;
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const k = l2 ? Math.min(1, Math.max(0, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2)) : 0;
    const q = { x: a.x + ab.x * k, y: a.y + ab.y * k };
    const d = dist(q, p);
    const l = Math.sqrt(l2);
    if (d < best.distance) best = { point: q, distance: d, t: path.length ? (acc + l * k) / path.length : 0, span: path.polySpan[i]! };
    acc += l;
  }
  return best;
}

/** Where to insert a waypoint for a point on user span `span`. */
export const waypointInsertIndex = (span: number) => span;

/**
 * True when waypoint `i` lies (almost) on the straight line between its
 * neighbours — dragging a point back into line removes it.
 */
export function isRedundantWaypoint(prev: Pt, p: Pt, next: Pt, tolerance = 6): boolean {
  const ab = sub(next, prev);
  const l = len(ab);
  if (l < 1) return true;
  const cross = Math.abs((p.x - prev.x) * ab.y - (p.y - prev.y) * ab.x) / l;
  const k = ((p.x - prev.x) * ab.x + (p.y - prev.y) * ab.y) / (l * l);
  return cross <= tolerance && k > 0 && k < 1;
}

/** Cardinal anchor points of a shape (for magnetic snapping feedback). */
export function anchorPoints(shape: SceneShape): Array<{ side: Side; point: Pt }> {
  if (shape.kind === 'circle') {
    const c = centerOf(shape.box);
    const r = Math.min(shape.box.w, shape.box.h) / 2;
    return (Object.keys(SIDE_NORMAL) as Side[]).map((side) => ({ side, point: add(c, mul(SIDE_NORMAL[side], r)) }));
  }
  return (Object.keys(SIDE_NORMAL) as Side[]).map((side) => ({ side, point: sidePoint(shape.box, side) }));
}

/** SVG path data for a connector path (export / tests / SSR). */
export function toSvgPath(path: ConnectorPath): string {
  const f = (n: number) => Math.round(n * 100) / 100;
  let d = `M ${f(path.start.x)} ${f(path.start.y)}`;
  for (const s of path.segs) {
    if (s.type === 'L') d += ` L ${f(s.to.x)} ${f(s.to.y)}`;
    else if (s.type === 'Q') d += ` Q ${f(s.c.x)} ${f(s.c.y)} ${f(s.to.x)} ${f(s.to.y)}`;
    else d += ` C ${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.to.x)} ${f(s.to.y)}`;
  }
  return d;
}
