import type { BoardElement } from '../../types';

/**
 * Connector model — the relational, render-independent description of an
 * arrow/line. Stored inside the element (see `readConnector` / `connectorPatch`)
 * so it syncs and versions like any other element; the drawn path is always
 * recomputed from it, so every client renders identical geometry.
 */

export type Side = 'top' | 'right' | 'bottom' | 'left';

/** Where a connector end attaches on its shape. */
export type Anchor =
  /** Floating: slides along the outline to face the other end as things move. */
  | { type: 'auto' }
  /** Fixed to the midpoint of one side. */
  | { type: 'side'; side: Side }
  /** Fixed to a point on the outline, normalized to the shape's box (0..1). */
  | { type: 'point'; nx: number; ny: number };

export interface ConnectorEnd {
  elementId?: string;
  anchor: Anchor;
  /** Last resolved world point (used when free, and as a fallback). */
  point: { x: number; y: number };
}

export type Routing = 'straight' | 'curved' | 'elbow';

export type Marker = 'none' | 'arrow' | 'stealth' | 'triangle' | 'triangle-open' | 'circle' | 'diamond' | 'bar';

export const MARKERS: Marker[] = ['none', 'arrow', 'stealth', 'triangle', 'triangle-open', 'circle', 'diamond', 'bar'];

export interface ConnectorModel {
  start: ConnectorEnd;
  end: ConnectorEnd;
  /** User control points (straight & curved routes). */
  waypoints: Array<{ x: number; y: number }>;
  routing: Routing;
  /** Extra perpendicular bow of a curved route at its midpoint (world px). */
  bend: number;
  startMarker: Marker;
  endMarker: Marker;
  stroke: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  opacity: number;
  animated: boolean;
  label: string;
  /** Label position along the path (0..1 of arc length). */
  labelT: number;
}

export const isConnectorKind = (kind: BoardElement['kind']) => kind === 'line' || kind === 'arrow';

const ANCHOR_SIDES = new Set<Side>(['top', 'right', 'bottom', 'left']);

function readAnchor(raw: unknown): Anchor {
  if (raw && typeof raw === 'object') {
    const a = raw as { type?: string; side?: string; nx?: number; ny?: number };
    if (a.type === 'side' && a.side && ANCHOR_SIDES.has(a.side as Side)) return { type: 'side', side: a.side as Side };
    if (a.type === 'point' && Number.isFinite(a.nx) && Number.isFinite(a.ny)) {
      return { type: 'point', nx: Math.min(1, Math.max(0, a.nx!)), ny: Math.min(1, Math.max(0, a.ny!)) };
    }
  }
  return { type: 'auto' };
}

const isMarker = (m: unknown): m is Marker => typeof m === 'string' && (MARKERS as string[]).includes(m);

/** Normalizes any stored connector (including legacy shapes of the data). */
export function readConnector(el: BoardElement): ConnectorModel {
  let pts = (el.points && el.points.length >= 4 ? el.points : [el.x, el.y, el.x + (el.width || 0), el.y]) as number[];
  // Very old rows stored points relative to the line's center (with a sized
  // bbox); seed rows and the current format store absolute points.
  if (el.points && !el.pointsAbsolute && (el.width || el.height)) {
    const cx = el.x + (el.width || 0) / 2;
    const cy = el.y + (el.height || 0) / 2;
    pts = [pts[0]! + cx, pts[1]! + cy, pts[2]! + cx, pts[3]! + cy];
  }
  const flat = el.waypoints ?? [];
  const waypoints: Array<{ x: number; y: number }> = [];
  for (let i = 0; i + 1 < flat.length; i += 2) waypoints.push({ x: flat[i]!, y: flat[i + 1]! });
  const routing: Routing = el.routing ?? (el.bend ? 'curved' : 'straight');
  return {
    start: { elementId: el.startBinding?.elementId, anchor: readAnchor(el.startBinding?.anchor), point: { x: pts[0]!, y: pts[1]! } },
    end: { elementId: el.endBinding?.elementId, anchor: readAnchor(el.endBinding?.anchor), point: { x: pts[2]!, y: pts[3]! } },
    waypoints,
    routing,
    bend: el.bend ?? 0,
    startMarker: isMarker(el.startMarker) ? el.startMarker : 'none',
    endMarker: isMarker(el.endMarker) ? el.endMarker : el.kind === 'arrow' ? 'arrow' : 'none',
    stroke: el.stroke || '#a8a69c',
    strokeWidth: el.strokeWidth || 1.75,
    strokeStyle: el.strokeStyle ?? 'solid',
    opacity: el.opacity ?? 1,
    animated: !!el.animated,
    label: el.label ?? '',
    labelT: Number.isFinite(el.labelT) ? Math.min(0.95, Math.max(0.05, el.labelT!)) : 0.5,
  };
}

/** Element fields that persist a connector model (geometry + style). */
export function connectorPatch(model: ConnectorModel): Partial<BoardElement> {
  const s = model.start.point;
  const e = model.end.point;
  const xs = [s.x, e.x, ...model.waypoints.map((p) => p.x)];
  const ys = [s.y, e.y, ...model.waypoints.map((p) => p.y)];
  const anchorOut = (a: Anchor) => (a.type === 'auto' ? undefined : a);
  return {
    points: [s.x, s.y, e.x, e.y],
    pointsAbsolute: true,
    x: Math.min(...xs),
    y: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    startBinding: model.start.elementId ? { elementId: model.start.elementId, ...(anchorOut(model.start.anchor) ? { anchor: anchorOut(model.start.anchor) } : {}) } : null,
    endBinding: model.end.elementId ? { elementId: model.end.elementId, ...(anchorOut(model.end.anchor) ? { anchor: anchorOut(model.end.anchor) } : {}) } : null,
    waypoints: model.waypoints.flatMap((p) => [p.x, p.y]),
    routing: model.routing,
    bend: model.bend,
    startMarker: model.startMarker,
    endMarker: model.endMarker,
    animated: model.animated,
    label: model.label,
    labelT: model.labelT,
  };
}
