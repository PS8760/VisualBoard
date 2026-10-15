import { describe, expect, it } from 'vitest';
import { readConnector, connectorPatch } from '../src/services/connectors/model';
import {
  computeConnectorPath,
  isRedundantWaypoint,
  nearestOnPath,
  orthogonalRoute,
  pointAt,
  sceneFrom,
  toSvgPath,
} from '../src/services/connectors/route';
import type { BoardElement } from '../src/types';

const rect = (id: string, x: number, y: number, w = 160, h = 60, kind: BoardElement['kind'] = 'rect'): BoardElement => ({
  id, kind, x, y, width: w, height: h, rotation: 0, fill: '#fff', stroke: '#000', strokeWidth: 1, content: '', version: 1,
});

const conn = (extra: Partial<BoardElement>): BoardElement => ({
  id: 'k', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0, fill: 'transparent', stroke: '#888',
  strokeWidth: 1.5, content: '', version: 1, points: [0, 0, 100, 0], pointsAbsolute: true, ...extra,
});

/** Every segment of an orthogonal polyline is horizontal or vertical. */
const isOrthogonal = (pts: Array<{ x: number; y: number }>) =>
  pts.every((p, i) => i === 0 || Math.abs(p.x - pts[i - 1]!.x) < 0.01 || Math.abs(p.y - pts[i - 1]!.y) < 0.01);

/** No segment passes through the interior of a box (shrunk by `inset`). */
const avoids = (pts: Array<{ x: number; y: number }>, b: { x: number; y: number; w: number; h: number }, inset = 1) =>
  pts.every((p, i) => {
    if (i === 0) return true;
    const a = pts[i - 1]!;
    for (let k = 0; k <= 50; k++) {
      const x = a.x + ((p.x - a.x) * k) / 50;
      const y = a.y + ((p.y - a.y) * k) / 50;
      if (x > b.x + inset && x < b.x + b.w - inset && y > b.y + inset && y < b.y + b.h - inset) return false;
    }
    return true;
  });

describe('connector model', () => {
  it('reads legacy rows and round-trips the full model', () => {
    const legacy = readConnector(conn({ bend: 30, startBinding: { elementId: 'a' } }));
    expect(legacy).toMatchObject({ routing: 'curved', endMarker: 'arrow', startMarker: 'none', start: { elementId: 'a', anchor: { type: 'auto' } } });
    const line = readConnector(conn({ kind: 'line' }));
    expect(line.endMarker).toBe('none');

    const m = readConnector(conn({}));
    m.routing = 'elbow';
    m.start = { elementId: 'a', anchor: { type: 'side', side: 'right' }, point: { x: 1, y: 2 } };
    m.waypoints = [{ x: 5, y: 6 }];
    m.label = 'HTTPS';
    const back = readConnector(conn(connectorPatch(m)));
    expect(back).toMatchObject({ routing: 'elbow', label: 'HTTPS', waypoints: [{ x: 5, y: 6 }], start: { anchor: { type: 'side', side: 'right' } } });
  });
});

describe('anchoring', () => {
  const scene = sceneFrom([rect('a', 0, 0), rect('b', 400, 200), rect('c', 0, 300, 100, 100, 'circle')]);

  it('floating ends meet the outline exactly along the line between shapes', () => {
    const p = computeConnectorPath(readConnector(conn({ startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } })), scene);
    // Each tip sits just outside its shape's outline (within the 3px gap).
    const gapTo = (pt: { x: number; y: number }, b: { x: number; y: number; w: number; h: number }) =>
      Math.hypot(Math.max(b.x - pt.x, 0, pt.x - (b.x + b.w)), Math.max(b.y - pt.y, 0, pt.y - (b.y + b.h)));
    expect(gapTo(p.start, { x: 0, y: 0, w: 160, h: 60 })).toBeGreaterThan(0.5);
    expect(gapTo(p.start, { x: 0, y: 0, w: 160, h: 60 })).toBeLessThanOrEqual(3.01);
    expect(gapTo(p.end, { x: 400, y: 200, w: 160, h: 60 })).toBeLessThanOrEqual(3.01);
  });

  it('fixed side anchors attach at the side midpoint', () => {
    const p = computeConnectorPath(
      readConnector(conn({ startBinding: { elementId: 'a', anchor: { type: 'side', side: 'bottom' } }, endBinding: { elementId: 'b', anchor: { type: 'side', side: 'left' } } })),
      scene,
    );
    expect(p.start).toEqual({ x: 80, y: 63 });
    expect(p.end).toEqual({ x: 397, y: 230 });
  });

  it('anchors on circles land on the circumference', () => {
    const p = computeConnectorPath(readConnector(conn({ startBinding: { elementId: 'c' }, points: [0, 0, 50, 900] })), scene);
    const d = Math.hypot(p.start.x - 50, p.start.y - 350);
    expect(d).toBeCloseTo(53, 0);
  });
});

describe('orthogonal (A*) routing', () => {
  it('routes around an obstacle with only right angles and clearance', () => {
    const obstacle = { x: 150, y: -60, w: 100, h: 120 };
    const pts = orthogonalRoute({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 400, y: 0 }, { x: -1, y: 0 }, [obstacle]);
    expect(isOrthogonal(pts)).toBe(true);
    expect(avoids(pts, { x: obstacle.x - 17, y: obstacle.y - 17, w: obstacle.w + 34, h: obstacle.h + 34 })).toBe(true);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 400, y: 0 });
  });

  it('connects facing sides of offset shapes with a clean Z', () => {
    const scene = sceneFrom([rect('a', 0, 0), rect('b', 400, 200)]);
    const path = computeConnectorPath(readConnector(conn({ routing: 'elbow', startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } })), scene);
    expect(path.start.x).toBeCloseTo(163); // leaves A's right side
    expect(path.end.x).toBeCloseTo(397); // enters B's left side
    expect(path.endDir).toEqual({ x: 1, y: 0 }); // arrives travelling right, into B
  });

  it('never cuts through the shapes it connects or any in between', () => {
    const els = [rect('a', 0, 0), rect('mid', 250, -20, 100, 100), rect('b', 500, 0)];
    const scene = sceneFrom(els);
    const path = computeConnectorPath(readConnector(conn({ routing: 'elbow', startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } })), scene);
    for (const el of els) expect(avoids(path.poly, { x: el.x, y: el.y, w: el.width, h: el.height }, 2)).toBe(true);
  });
});

describe('curves, polylines and loops', () => {
  const scene = sceneFrom([rect('a', 0, 0), rect('b', 400, 0)]);

  it('curved routes leave along the anchor normal', () => {
    const path = computeConnectorPath(readConnector(conn({ routing: 'curved', startBinding: { elementId: 'a', anchor: { type: 'side', side: 'bottom' } }, endBinding: { elementId: 'b' } })), scene);
    expect(path.segs[0]!.type).toBe('C');
    // First step heads down (out of the bottom side).
    expect(path.poly[1]!.y).toBeGreaterThan(path.start.y);
  });

  it('straight routes pass through waypoints; collinear waypoints are redundant', () => {
    const path = computeConnectorPath(readConnector(conn({ points: [0, 0, 200, 0], waypoints: [100, 80] })), sceneFrom([]));
    expect(path.poly).toContainEqual({ x: 100, y: 80 });
    expect(isRedundantWaypoint({ x: 0, y: 0 }, { x: 100, y: 3 }, { x: 200, y: 0 })).toBe(true);
    expect(isRedundantWaypoint({ x: 0, y: 0 }, { x: 100, y: 80 }, { x: 200, y: 0 })).toBe(false);
  });

  it('projects clicks onto the path and samples by arc length', () => {
    const path = computeConnectorPath(readConnector(conn({ points: [0, 0, 200, 0] })), sceneFrom([]));
    const hit = nearestOnPath(path, { x: 50, y: 10 });
    expect(hit.distance).toBeCloseTo(10);
    expect(hit.t).toBeCloseTo(0.25);
    expect(pointAt(path, 0.5).point).toEqual({ x: 100, y: 0 });
  });

  it('draws a self-loop when both ends bind to the same shape', () => {
    const path = computeConnectorPath(readConnector(conn({ startBinding: { elementId: 'a' }, endBinding: { elementId: 'a' } })), scene);
    expect(path.selfLoop).toBe(true);
    expect(path.bbox.x + path.bbox.w).toBeGreaterThan(160);
    expect(path.bbox.y).toBeLessThan(0);
  });

  it('emits SVG path data', () => {
    const path = computeConnectorPath(readConnector(conn({ points: [0, 0, 100, 50] })), sceneFrom([]));
    expect(toSvgPath(path)).toBe('M 0 0 L 100 50');
  });
});
