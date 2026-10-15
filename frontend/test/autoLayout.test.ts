import { describe, expect, it } from 'vitest';
import { computeAutoLayout, clearanceBend } from '../src/services/autoLayout';
import type { BoardElement } from '../src/types';

const box = (id: string, x: number, y: number, extra: Partial<BoardElement> = {}): BoardElement => ({
  id, kind: 'rect', x, y, width: 160, height: 60, rotation: 0, fill: '#fff', stroke: '#000',
  strokeWidth: 1, content: id, version: 1, ...extra,
});

const arrow = (id: string, pts: [number, number, number, number], extra: Partial<BoardElement> = {}): BoardElement => ({
  id, kind: 'arrow', x: Math.min(pts[0], pts[2]), y: Math.min(pts[1], pts[3]), width: Math.abs(pts[2] - pts[0]),
  height: Math.abs(pts[3] - pts[1]), rotation: 0, fill: 'transparent', stroke: '#888', strokeWidth: 1.5, content: '',
  points: pts, pointsAbsolute: true, version: 1, ...extra,
});

const center = (p: { x: number; y: number }, w = 160, h = 60) => ({ x: p.x + w / 2, y: p.y + h / 2 });

describe('computeAutoLayout', () => {
  // The exact scenario from the bug report: a bound chain plus a sticky note,
  // previously scattered on a grid with arrows treated as boxes.
  const chain = [
    box('client', 0, 300),
    box('api', 600, 40),
    box('db', 120, 700),
    arrow('a1', [160, 330, 600, 70], { startBinding: { elementId: 'client' }, endBinding: { elementId: 'api' } }),
    arrow('a2', [760, 70, 120, 730], { startBinding: { elementId: 'api' }, endBinding: { elementId: 'db' } }),
    box('note', 400, 900, { kind: 'sticky', width: 200, height: 110 }),
  ];

  it('lays a flow out in order on one centerline, never moving connectors as boxes', () => {
    const r = computeAutoLayout(chain);
    const c = center(r.positions.get('client')!);
    const a = center(r.positions.get('api')!);
    const d = center(r.positions.get('db')!);
    expect(c.x).toBeLessThan(a.x);
    expect(a.x).toBeLessThan(d.x);
    expect(new Set([c.y, a.y, d.y]).size).toBe(1);
    expect(r.positions.has('a1')).toBe(false);
    expect(r.positions.has('a2')).toBe(false);
    expect(r.direction).toBe('LR');
    expect(r.flowNodes).toBe(3);
  });

  it('routes connectors edge-to-edge between their shapes', () => {
    const r = computeAutoLayout(chain);
    const pts = r.connectors.get('a1')!.points;
    const client = r.positions.get('client')!;
    const api = r.positions.get('api')!;
    expect(pts[0]).toBeGreaterThan(client.x + 160); // leaves the right edge of Client
    expect(pts[2]).toBeLessThan(api.x); // arrives at the left edge of API
    expect(pts[1]).toBeCloseTo(pts[3]); // horizontal
  });

  it('puts unconnected notes beside the diagram, not inside the flow', () => {
    const r = computeAutoLayout(chain);
    const note = r.positions.get('note')!;
    const rightmost = Math.max(...['client', 'api', 'db'].map((id) => r.positions.get(id)!.x + 160));
    expect(note.x).toBeGreaterThan(rightmost);
  });

  it('stays anchored at the original top-left', () => {
    const r = computeAutoLayout(chain);
    const xs = [...r.positions.entries()].map(([, p]) => p.x);
    const ys = [...r.positions.entries()].map(([, p]) => p.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.min(...ys)).toBe(40);
  });

  it('infers and binds unbound arrows whose ends rest on shapes', () => {
    const els = [box('a', 0, 0), box('b', 400, 0), arrow('x', [165, 30, 395, 30])];
    const r = computeAutoLayout(els);
    expect(r.connectors.get('x')).toMatchObject({ startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } });
  });

  it('keeps a vertically drawn diagram vertical', () => {
    const els = [
      box('top', 0, 0),
      box('mid', 20, 300),
      box('bottom', -10, 600),
      arrow('e1', [80, 60, 100, 300], { startBinding: { elementId: 'top' }, endBinding: { elementId: 'mid' } }),
      arrow('e2', [100, 360, 70, 600], { startBinding: { elementId: 'mid' }, endBinding: { elementId: 'bottom' } }),
    ];
    const r = computeAutoLayout(els);
    expect(r.direction).toBe('TB');
    const ys = ['top', 'mid', 'bottom'].map((id) => r.positions.get(id)!.y);
    expect(ys[0]).toBeLessThan(ys[1]!);
    expect(ys[1]).toBeLessThan(ys[2]!);
  });

  it('places branches side by side in the same rank', () => {
    const els = [
      box('root', 0, 200),
      box('l', 400, 0),
      box('r', 400, 400),
      arrow('e1', [0, 0, 1, 1], { startBinding: { elementId: 'root' }, endBinding: { elementId: 'l' } }),
      arrow('e2', [0, 0, 1, 1], { startBinding: { elementId: 'root' }, endBinding: { elementId: 'r' } }),
    ];
    const r = computeAutoLayout(els);
    expect(r.positions.get('l')!.x).toBe(r.positions.get('r')!.x);
    expect(r.positions.get('l')!.y).toBeLessThan(r.positions.get('r')!.y);
    // Root centered between its children.
    const mid = (center(r.positions.get('l')!).y + center(r.positions.get('r')!).y) / 2;
    expect(Math.abs(center(r.positions.get('root')!).y - mid)).toBeLessThanOrEqual(20);
  });

  it('survives cycles', () => {
    const els = [
      box('a', 0, 0),
      box('b', 300, 0),
      arrow('ab', [0, 0, 1, 1], { startBinding: { elementId: 'a' }, endBinding: { elementId: 'b' } }),
      arrow('ba', [0, 0, 1, 1], { startBinding: { elementId: 'b' }, endBinding: { elementId: 'a' } }),
    ];
    const r = computeAutoLayout(els);
    expect(r.positions.size).toBe(2);
  });

  it('never moves locked items, ink, or anything outside the selection', () => {
    const els = [
      box('a', 0, 0),
      box('b', 900, 500),
      box('locked', 50, 800, { locked: true }),
      box('ink', 0, 0, { kind: 'pen' }),
    ];
    const r = computeAutoLayout(els, new Set(['a', 'b', 'locked', 'ink']));
    expect(r.positions.has('locked')).toBe(false);
    expect(r.positions.has('ink')).toBe(false);
    const scoped = computeAutoLayout(els, new Set(['a']));
    expect([...scoped.positions.keys()]).toEqual(['a']);
  });

  it('curves long edges around the shapes they would cut through, keeps short ones straight', () => {
    const els = [
      box('client', 0, 0),
      box('api', 300, 0),
      box('queue', 600, 0),
      box('db', 900, 0),
      arrow('e1', [0, 0, 1, 1], { startBinding: { elementId: 'client' }, endBinding: { elementId: 'api' } }),
      arrow('e2', [0, 0, 1, 1], { startBinding: { elementId: 'api' }, endBinding: { elementId: 'queue' } }),
      arrow('e3', [0, 0, 1, 1], { startBinding: { elementId: 'queue' }, endBinding: { elementId: 'db' } }),
      arrow('skip', [0, 0, 1, 1], { startBinding: { elementId: 'api' }, endBinding: { elementId: 'db' } }),
    ];
    const r = computeAutoLayout(els);
    expect(r.connectors.get('e1')!.bend).toBe(0);
    expect(r.connectors.get('e2')!.bend).toBe(0);
    // Arcs over the top (negative = up for a left→right edge).
    expect(r.connectors.get('skip')!.bend).toBeLessThan(-40);
  });
});

describe('clearanceBend', () => {
  it('is zero for a clear path and lifts over an obstacle otherwise', () => {
    expect(clearanceBend({ x: 0, y: 0 }, { x: 400, y: 0 }, [{ x: 150, y: 100, w: 100, h: 60 }])).toBe(0);
    const bend = clearanceBend({ x: 0, y: 0 }, { x: 400, y: 0 }, [{ x: 150, y: -30, w: 100, h: 60 }]);
    // Curve offset at the obstacle must exceed its half-height plus margin.
    expect(Math.abs(bend)).toBeGreaterThan(30 + 20);
  });
});

