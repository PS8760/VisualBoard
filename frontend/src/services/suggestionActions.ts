import type { BoardElement, Suggestion } from '../types';
import { uid } from '../utils';
import { elementBox, unionBox, type Box } from './geometry';
import { connectorPatch, readConnector } from './connectors/model';

/**
 * Turns a suggestion's action into concrete board edits. Pure: the caller
 * applies `add`/`remove` in one history step and selects `focus`.
 */
export interface SuggestionPlan {
  add: BoardElement[];
  remove: string[];
  /** Elements to select and frame afterwards. */
  focus: string[];
}

const NODE_W = 170;
const NODE_H = 60;
const GAP = 40;

function newNode(label: string, x: number, y: number): BoardElement {
  return {
    id: uid('el'), kind: 'rect', x: Math.round(x), y: Math.round(y), width: NODE_W, height: NODE_H, rotation: 0,
    fill: '#fdf3ec', stroke: '#d9480f', strokeWidth: 1.5, radius: 8, fontSize: 14, content: label, version: 0,
  };
}

const overlaps = (a: Box, b: Box, pad = 16) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Nearest free slot to (cx, cy), searching outward in rings. */
function freeSpot(cx: number, cy: number, obstacles: Box[], prefer: 'below' | 'any' = 'any'): { x: number; y: number } {
  const at = (x: number, y: number): Box => ({ x: x - NODE_W / 2, y: y - NODE_H / 2, w: NODE_W, h: NODE_H });
  const clear = (b: Box) => !obstacles.some((o) => overlaps(b, o));
  if (prefer === 'any' && clear(at(cx, cy))) return { x: cx - NODE_W / 2, y: cy - NODE_H / 2 };
  const stepY = NODE_H + GAP;
  const stepX = NODE_W + GAP;
  for (let ring = 1; ring <= 8; ring++) {
    const offsets: Array<[number, number]> = [
      [0, ring * stepY], [0, -ring * stepY], [ring * stepX, 0], [-ring * stepX, 0],
      [ring * stepX, ring * stepY], [-ring * stepX, ring * stepY], [ring * stepX, -ring * stepY], [-ring * stepX, -ring * stepY],
    ];
    for (const [dx, dy] of offsets) {
      const b = at(cx + dx, cy + dy);
      if (clear(b)) return { x: b.x, y: b.y };
    }
  }
  return { x: cx - NODE_W / 2, y: cy + 4 * (NODE_H + GAP) };
}

const midOf = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

/** A connector from `a` to `b`, styled like `template` when given. */
function link(a: BoardElement, b: BoardElement, template?: BoardElement): BoardElement {
  const pa = midOf(elementBox(a));
  const pb = midOf(elementBox(b));
  const base: BoardElement = template
    ? { ...template }
    : {
        id: '', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0, fill: 'transparent',
        stroke: '#a8a69c', strokeWidth: 1.5, content: '', version: 0,
      };
  const model = readConnector(base);
  model.start = { elementId: a.id, anchor: { type: 'auto' }, point: pa };
  model.end = { elementId: b.id, anchor: { type: 'auto' }, point: pb };
  model.waypoints = [];
  model.bend = 0;
  model.label = '';
  return { ...base, ...connectorPatch(model), id: uid('el'), version: 0, label: '' };
}

export function planSuggestion(s: Suggestion, elements: BoardElement[]): SuggestionPlan | null {
  const byId = new Map(elements.map((e) => [e.id, e]));
  const obstacles = elements.filter((e) => e.kind !== 'arrow' && e.kind !== 'line').map(elementBox);
  const action = s.action;

  if (action.type === 'select') return { add: [], remove: [], focus: action.ids.filter((id) => byId.has(id)) };

  if (action.type === 'route-through') {
    const edges = action.edgeIds.map((id) => byId.get(id)).filter((e): e is BoardElement => !!e);
    const ends = edges.map((e) => {
      const m = readConnector(e);
      return { edge: e, from: m.start.elementId && byId.get(m.start.elementId), to: m.end.elementId && byId.get(m.end.elementId), m };
    });
    // Legacy unbound arrows: fall back to the suggestion's elements nearest each end.
    const nearest = (p: { x: number; y: number }) =>
      s.elementIds
        .map((id) => byId.get(id))
        .filter((e): e is BoardElement => !!e && e.kind !== 'arrow' && e.kind !== 'line')
        .sort((a, b) => dist(midOf(elementBox(a)), p) - dist(midOf(elementBox(b)), p))[0];
    const resolved = ends
      .map((x) => ({ ...x, from: x.from || nearest(x.m.start.point), to: x.to || nearest(x.m.end.point) }))
      .filter((x): x is typeof x & { from: BoardElement; to: BoardElement } => !!x.from && !!x.to && x.from !== x.to);
    if (!resolved.length) return null;

    // Hub sits where the routed edges meet: between the sources and targets.
    const srcs = unionBox([...new Set(resolved.map((r) => r.from))].map(elementBox))!;
    const dsts = unionBox([...new Set(resolved.map((r) => r.to))].map(elementBox))!;
    const c = { x: (midOf(srcs).x + midOf(dsts).x) / 2, y: (midOf(srcs).y + midOf(dsts).y) / 2 };
    const spot = freeSpot(c.x, c.y, obstacles);
    const hub = newNode(action.label, spot.x, spot.y);

    const add: BoardElement[] = [hub];
    const seenIn = new Set<string>();
    const seenOut = new Set<string>();
    for (const r of resolved) {
      if (!seenIn.has(r.from.id)) {
        seenIn.add(r.from.id);
        add.push(link(r.from, hub, r.edge));
      }
      if (!seenOut.has(r.to.id)) {
        seenOut.add(r.to.id);
        add.push(link(hub, r.to, r.edge));
      }
    }
    return { add, remove: resolved.map((r) => r.edge.id), focus: [hub.id] };
  }

  // add-node
  const near = action.near.map((id) => byId.get(id)).filter((e): e is BoardElement => !!e);
  const anchorBox = unionBox(near.map(elementBox)) ?? unionBox(obstacles) ?? { x: 0, y: 0, w: 0, h: 0 };
  const below = !action.linkTo; // standalone nodes (e.g. monitoring) go under the diagram
  const start = below
    ? { x: anchorBox.x + anchorBox.w / 2, y: anchorBox.y + anchorBox.h + GAP + NODE_H / 2 }
    : { x: anchorBox.x + anchorBox.w / 2, y: anchorBox.y + anchorBox.h / 2 };
  const spot = freeSpot(start.x, start.y, obstacles, below ? 'any' : 'below');
  const node = newNode(action.label, spot.x, spot.y);
  const add: BoardElement[] = [node];
  const target = action.linkTo ? byId.get(action.linkTo) : undefined;
  if (target) add.push(link(node, target));
  return { add, remove: [], focus: [node.id] };
}

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
