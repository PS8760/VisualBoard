import type { BoardElement } from '../types';
import { BINDABLE, elementBox, type Box } from './geometry';
import { readConnector, type Routing } from './connectors/model';
import { resolveEnds, sceneFrom } from './connectors/route';

/**
 * Flow-aware auto layout (layered / Sugiyama-style).
 *
 *  1. Connectors are EDGES, never nodes. Bindings are used when present;
 *     otherwise an endpoint resting on a shape is inferred as attached (and
 *     the binding is persisted so it follows from now on).
 *  2. Each connected component is ranked by longest path from its sources
 *     (cycles are broken by DFS back-edge reversal), ordered within each rank
 *     by barycenter sweeps to reduce crossings, and laid out along the
 *     diagram's dominant direction (left→right, or top→bottom when it was
 *     drawn vertically).
 *  3. Unconnected shapes form a tidy row under the diagram; sticky notes and
 *     free text are treated as annotations in a column beside it.
 *  4. The result is anchored at the original top-left so nothing jumps
 *     across the board. Pen strokes, comments and locked items never move.
 */

export interface LayoutResult {
  /** New top-left positions for moved elements. */
  positions: Map<string, { x: number; y: number }>;
  /** Connector updates: routed points and (possibly inferred) bindings. */
  connectors: Map<string, {
    points: [number, number, number, number];
    startBinding: { elementId: string } | null;
    endBinding: { elementId: string } | null;
    /** Curvature that routes the connector around shapes in its way (0 = straight). */
    bend: number;
    /** Routing after layout (straight connectors that must detour become curved). */
    routing: Routing;
  }>;
  direction: 'LR' | 'TB';
  /** Number of nodes laid out as part of a flow. */
  flowNodes: number;
}

const GRID = 20;
const RANK_GAP = 110; // between columns (LR) / rows (TB)
const NODE_GAP = 56; // between siblings inside a rank
const COMPONENT_GAP = 120;
const SECTION_GAP = 140;

const snap = (v: number) => Math.round(v / GRID) * GRID;

const isConnector = (el: BoardElement) => el.kind === 'line' || el.kind === 'arrow';
const isAnnotation = (el: BoardElement) => el.kind === 'sticky' || el.kind === 'text';

/** Node under a connector endpoint (binding first, then geometric inference). */
function endpointNode(
  conn: BoardElement,
  end: 'start' | 'end',
  nodes: BoardElement[],
  byId: Map<string, BoardElement>,
): BoardElement | null {
  const binding = end === 'start' ? conn.startBinding : conn.endBinding;
  if (binding && byId.has(binding.elementId)) return byId.get(binding.elementId)!;
  if (!conn.points || conn.points.length < 4) return null;
  const [x1, y1, x2, y2] = conn.points as [number, number, number, number];
  const p = end === 'start' ? { x: x1, y: y1 } : { x: x2, y: y2 };
  // Legacy rows stored center-relative points; they only make sense absolute.
  if (!conn.pointsAbsolute && (conn.width || conn.height)) return null;
  let best: { el: BoardElement; d: number } | null = null;
  for (const el of nodes) {
    const b = elementBox(el);
    const dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w));
    const dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h));
    const d = Math.hypot(dx, dy);
    if (d <= 36 && (!best || d < best.d)) best = { el, d };
  }
  return best?.el ?? null;
}

export function computeAutoLayout(all: BoardElement[], scope?: Set<string>): LayoutResult {
  const inScope = (el: BoardElement) => !scope || scope.has(el.id);
  const nodes = all.filter((el) => BINDABLE.has(el.kind) && !el.locked && inScope(el));
  const byId = new Map(all.map((el) => [el.id, el] as const));
  const nodeIds = new Set(nodes.map((n) => n.id));

  // ---- edges ---------------------------------------------------------------
  type Edge = { conn: BoardElement; from: string; to: string };
  const edges: Edge[] = [];
  const connectorEnds = new Map<string, { start: BoardElement | null; end: BoardElement | null }>();
  for (const conn of all.filter(isConnector)) {
    const start = endpointNode(conn, 'start', nodes, byId);
    const end = endpointNode(conn, 'end', nodes, byId);
    connectorEnds.set(conn.id, { start, end });
    if (start && end && start.id !== end.id && nodeIds.has(start.id) && nodeIds.has(end.id)) {
      edges.push({ conn, from: start.id, to: end.id });
    }
  }

  const connected = new Set(edges.flatMap((e) => [e.from, e.to]));
  const flow = nodes.filter((n) => connected.has(n.id));
  const loose = nodes.filter((n) => !connected.has(n.id) && !isAnnotation(n));
  const notes = nodes.filter((n) => !connected.has(n.id) && isAnnotation(n));

  const original = new Map(nodes.map((n) => [n.id, elementBox(n)] as const));
  const originalBounds = unionOf([...original.values()]);

  // Dominant direction of the drawing as the user made it.
  let horiz = 0;
  let vert = 0;
  for (const e of edges) {
    const a = original.get(e.from)!;
    const b = original.get(e.to)!;
    horiz += Math.abs(b.x + b.w / 2 - (a.x + a.w / 2));
    vert += Math.abs(b.y + b.h / 2 - (a.y + a.h / 2));
  }
  // Left→right unless the drawing is clearly vertical (most flows read LR).
  const direction: 'LR' | 'TB' = vert > horiz * 2 ? 'TB' : 'LR';
  // main axis = flow direction, cross axis = siblings.
  const mainSize = (b: Box) => (direction === 'LR' ? b.w : b.h);
  const crossSize = (b: Box) => (direction === 'LR' ? b.h : b.w);
  const crossPos = (b: Box) => (direction === 'LR' ? b.y + b.h / 2 : b.x + b.w / 2);

  const out = new Map<string, { x: number; y: number }>();

  // ---- components ------------------------------------------------------------
  const adj = new Map<string, Set<string>>();
  for (const n of flow) adj.set(n.id, new Set());
  for (const e of edges) {
    adj.get(e.from)!.add(e.to);
    adj.get(e.to)!.add(e.from);
  }
  const components: string[][] = [];
  const seen = new Set<string>();
  for (const n of flow) {
    if (seen.has(n.id)) continue;
    const comp: string[] = [];
    const stack = [n.id];
    seen.add(n.id);
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(id);
      for (const m of adj.get(id)!) {
        if (seen.has(m)) continue;
        seen.add(m);
        stack.push(m);
      }
    }
    components.push(comp);
  }
  // Keep components in their original reading order.
  components.sort((a, b) => {
    const ba = unionOf(a.map((id) => original.get(id)!));
    const bb = unionOf(b.map((id) => original.get(id)!));
    return direction === 'LR' ? ba.y - bb.y || ba.x - bb.x : ba.x - bb.x || ba.y - bb.y;
  });

  let crossCursor = 0; // offset of the next component along the cross axis
  let flowMainExtent = 0;
  let flowCrossExtent = 0;

  for (const comp of components) {
    const ids = new Set(comp);
    const compEdges = edges.filter((e) => ids.has(e.from) && ids.has(e.to));

    // Break cycles: reverse DFS back edges.
    const out1 = new Map<string, string[]>(comp.map((id) => [id, []]));
    for (const e of compEdges) out1.get(e.from)!.push(e.to);
    const state = new Map<string, 0 | 1 | 2>();
    const dag: Array<[string, string]> = [];
    const visit = (id: string) => {
      state.set(id, 1);
      for (const to of out1.get(id)!) {
        if (state.get(to) === 1) dag.push([to, id]);
        else {
          dag.push([id, to]);
          if (!state.get(to)) visit(to);
        }
      }
      state.set(id, 2);
    };
    // Start from the visually first nodes for stable results.
    const byReading = [...comp].sort((a, b) => {
      const A = original.get(a)!;
      const B = original.get(b)!;
      return direction === 'LR' ? A.x - B.x || A.y - B.y : A.y - B.y || A.x - B.x;
    });
    for (const id of byReading) if (!state.get(id)) visit(id);

    // Longest-path ranking.
    const preds = new Map<string, string[]>(comp.map((id) => [id, []]));
    for (const [a, b] of dag) if (a !== b) preds.get(b)!.push(a);
    const rank = new Map<string, number>();
    const rankOf = (id: string, guard = new Set<string>()): number => {
      if (rank.has(id)) return rank.get(id)!;
      if (guard.has(id)) return 0;
      guard.add(id);
      const r = Math.max(-1, ...preds.get(id)!.map((p) => rankOf(p, guard))) + 1;
      rank.set(id, r);
      return r;
    };
    comp.forEach((id) => rankOf(id));

    const maxRank = Math.max(...rank.values());
    const layers: string[][] = Array.from({ length: maxRank + 1 }, () => []);
    for (const id of comp) layers[rank.get(id)!]!.push(id);
    // Initial order: original cross-axis position.
    layers.forEach((layer) => layer.sort((a, b) => crossPos(original.get(a)!) - crossPos(original.get(b)!)));

    // Barycenter sweeps to reduce crossings.
    const neighbors = new Map<string, string[]>(comp.map((id) => [id, []]));
    for (const [a, b] of dag) {
      neighbors.get(a)!.push(b);
      neighbors.get(b)!.push(a);
    }
    for (let sweep = 0; sweep < 4; sweep++) {
      const order = sweep % 2 === 0 ? layers.map((_, i) => i).slice(1) : layers.map((_, i) => i).reverse().slice(1);
      for (const li of order) {
        const ref = layers[sweep % 2 === 0 ? li - 1 : li + 1];
        if (!ref) continue;
        const pos = new Map(ref.map((id, i) => [id, i] as const));
        const layer = layers[li]!;
        const bary = new Map(
          layer.map((id, i) => {
            const ns = neighbors.get(id)!.filter((n) => pos.has(n)).map((n) => pos.get(n)!);
            return [id, ns.length ? ns.reduce((s, v) => s + v, 0) / ns.length : i] as const;
          }),
        );
        layer.sort((a, b) => bary.get(a)! - bary.get(b)!);
      }
    }

    // Coordinates: ranks along the main axis, centered siblings across it.
    const layerMain = layers.map((layer) => Math.max(...layer.map((id) => mainSize(original.get(id)!))));
    const layerCross = layers.map(
      (layer) => layer.reduce((s, id) => s + crossSize(original.get(id)!), 0) + NODE_GAP * (layer.length - 1),
    );
    const compCross = Math.max(...layerCross);
    let mainCursor = 0;
    layers.forEach((layer, li) => {
      let c = crossCursor + (compCross - layerCross[li]!) / 2;
      for (const id of layer) {
        const b = original.get(id)!;
        // Center each node within its rank's main-axis band.
        const m = mainCursor + (layerMain[li]! - mainSize(b)) / 2;
        out.set(id, direction === 'LR' ? { x: m, y: c } : { x: c, y: m });
        c += crossSize(b) + NODE_GAP;
      }
      mainCursor += layerMain[li]! + RANK_GAP;
    });
    flowMainExtent = Math.max(flowMainExtent, mainCursor - RANK_GAP);
    crossCursor += compCross + COMPONENT_GAP;
    flowCrossExtent = crossCursor - COMPONENT_GAP;
  }

  // ---- loose shapes: a row under (LR) / column beside (TB) the flow ----------
  const flowW = direction === 'LR' ? flowMainExtent : flowCrossExtent;
  const flowH = direction === 'LR' ? flowCrossExtent : flowMainExtent;
  const hasFlow = flow.length > 0;
  let lx = 0;
  const looseY = hasFlow ? flowH + SECTION_GAP : 0;
  for (const el of [...loose].sort((a, b) => original.get(a.id)!.x - original.get(b.id)!.x)) {
    const b = original.get(el.id)!;
    out.set(el.id, { x: lx, y: looseY });
    lx += b.w + NODE_GAP;
  }
  const looseH = loose.length ? Math.max(...loose.map((el) => original.get(el.id)!.h)) : 0;

  // ---- annotations: a column to the right of everything ----------------------
  const contentW = Math.max(flowW, lx - NODE_GAP, 0);
  const notesX = contentW > 0 ? contentW + SECTION_GAP : 0;
  let ny = 0;
  for (const el of [...notes].sort((a, b) => original.get(a.id)!.y - original.get(b.id)!.y)) {
    out.set(el.id, { x: notesX, y: ny });
    ny += original.get(el.id)!.h + NODE_GAP / 2;
  }
  void looseH;

  // ---- anchor at the original top-left, snap to grid -------------------------
  const laid = unionOf([...out.entries()].map(([id, p]) => ({ ...p, w: original.get(id)!.w, h: original.get(id)!.h })));
  const dx = originalBounds.x - laid.x;
  const dy = originalBounds.y - laid.y;
  for (const [id, p] of out) out.set(id, { x: snap(p.x + dx), y: snap(p.y + dy) });

  // ---- connectors: re-route to the new positions (binding what we inferred) --
  const moved = new Map(all.map((el) => [el.id, el] as const));
  for (const [id, p] of out) {
    const el = moved.get(id)!;
    moved.set(id, { ...el, x: p.x, y: p.y });
  }
  const connectors: LayoutResult['connectors'] = new Map();
  const obstacles = [...moved.values()].filter((el) => BINDABLE.has(el.kind));
  const scene = sceneFrom([...moved.values()]);
  for (const conn of all.filter(isConnector)) {
    const ends = connectorEnds.get(conn.id)!;
    if (!ends.start && !ends.end) continue;
    const model = readConnector(conn);
    const startEl = ends.start ? moved.get(ends.start.id)! : null;
    const endEl = ends.end ? moved.get(ends.end.id)! : null;
    // Orthogonal routes avoid obstacles themselves; straight ones that would
    // cut through shapes (long edges) become gentle curves around them.
    let routing = model.routing;
    let bend = model.routing === 'curved' ? model.bend : 0;
    if (model.routing !== 'elbow' && startEl && endEl) {
      const clearance = clearanceBend(
        centerOf(elementBox(startEl)),
        centerOf(elementBox(endEl)),
        obstacles.filter((o) => o.id !== startEl.id && o.id !== endEl.id).map(elementBox),
        direction,
      );
      if (clearance) {
        routing = 'curved';
        bend = clearance;
      } else if (model.routing === 'curved' && !model.waypoints.length) {
        bend = 0;
      }
    }
    const startBinding = ends.start ? { elementId: ends.start.id, ...(conn.startBinding?.anchor ? { anchor: conn.startBinding.anchor } : {}) } : null;
    const endBinding = ends.end ? { elementId: ends.end.id, ...(conn.endBinding?.anchor ? { anchor: conn.endBinding.anchor } : {}) } : null;
    const bound = readConnector({ ...conn, startBinding, endBinding, routing, bend, pointsAbsolute: true });
    const resolved = resolveEnds(bound, scene);
    connectors.set(conn.id, {
      points: [resolved.start.point.x, resolved.start.point.y, resolved.end.point.x, resolved.end.point.y],
      startBinding,
      endBinding,
      bend,
      routing,
    });
  }

  return { positions: out, connectors, direction, flowNodes: flow.length };
}

function unionOf(boxes: Box[]): Box {
  if (!boxes.length) return { x: 0, y: 0, w: 0, h: 0 };
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    w: Math.max(...boxes.map((b) => b.x + b.w)) - x,
    h: Math.max(...boxes.map((b) => b.y + b.h)) - y,
  };
}

const centerOf = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/**
 * Curvature (signed, see `bendControl`) that lifts the a→b connector clear of
 * every box its straight chord would cross. 0 when the chord is already clear.
 * Picks the side needing the gentler arc (above/left on ties).
 */
export function clearanceBend(
  a: { x: number; y: number },
  b: { x: number; y: number },
  boxes: Box[],
  direction: 'LR' | 'TB' = 'LR',
): number {
  const MARGIN = 26;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1) return 0;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const nx = -uy;
  const ny = ux;
  const pad = 12;
  const hits = boxes.filter((bx) => {
    for (let i = 1; i < 32; i++) {
      const t = i / 32;
      const px = a.x + (b.x - a.x) * t;
      const py = a.y + (b.y - a.y) * t;
      if (px >= bx.x - pad && px <= bx.x + bx.w + pad && py >= bx.y - pad && py <= bx.y + bx.h + pad) return true;
    }
    return false;
  });
  if (!hits.length) return 0;

  const need = (side: 1 | -1) => {
    let required = 0;
    for (const bx of hits) {
      const corners = [
        [bx.x, bx.y],
        [bx.x + bx.w, bx.y],
        [bx.x, bx.y + bx.h],
        [bx.x + bx.w, bx.y + bx.h],
      ];
      const reach = Math.max(...corners.map(([x, y]) => side * ((x! - a.x) * nx + (y! - a.y) * ny)), 0);
      const c = centerOf(bx);
      const t = Math.min(0.88, Math.max(0.12, ((c.x - a.x) * ux + (c.y - a.y) * uy) / len));
      required = Math.max(required, (reach + MARGIN) / (4 * t * (1 - t)));
    }
    return Math.min(required, 600);
  };
  const plus = need(1);
  const minus = need(-1);
  // On ties prefer arcing over the top (LR) / to the left (TB) of the diagram.
  const preferMinus = direction === 'LR' ? ny > 0 : nx > 0;
  if (Math.abs(plus - minus) < 1) return preferMinus ? -minus : plus;
  return plus < minus ? plus : -minus;
}
