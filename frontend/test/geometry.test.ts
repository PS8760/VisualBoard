import { describe, expect, it } from 'vitest';
import { computeSnap, recognizeStroke, sortByZ, bindableAt } from '../src/services/geometry';
import type { BoardElement } from '../src/types';

const el = (id: string, extra: Partial<BoardElement> = {}): BoardElement => ({
  id, kind: 'rect', x: 0, y: 0, width: 100, height: 50, rotation: 0, fill: '#fff', stroke: '#000',
  strokeWidth: 1, content: '', version: 1, ...extra,
});

const circleStroke = (cx: number, cy: number, r: number, n = 40) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r * (1 + (i % 3 === 0 ? 0.04 : -0.03)), cy + Math.sin(a) * r];
  }).flat();

const rectStroke = (x: number, y: number, w: number, h: number) => {
  const pts: number[] = [];
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    for (let t = 0; t < 1; t += 0.1) pts.push(ax + (bx - ax) * t, ay + (by - ay) * t);
  };
  seg(x, y, x + w, y);
  seg(x + w, y, x + w, y + h);
  seg(x + w, y + h, x, y + h);
  seg(x, y + h, x, y + 3);
  return pts;
};

describe('hit testing', () => {
  it('finds the topmost bindable element under a point', () => {
    const els = [el('bottom'), el('line', { kind: 'line' }), el('top', { x: 50 })];
    expect(bindableAt(els, { x: 60, y: 10 })!.id).toBe('top');
    expect(bindableAt(els, { x: 500, y: 500 })).toBeNull();
  });
});

describe('smart guides', () => {
  it('snaps left edges within the threshold and reports a guide', () => {
    const r = computeSnap({ x: 103, y: 200, w: 50, h: 50 }, [{ x: 100, y: 0, w: 80, h: 40 }], 6);
    expect(r.dx).toBe(-3);
    expect(r.guides[0]).toMatchObject({ axis: 'x', at: 100 });
  });

  it('does nothing outside the threshold', () => {
    expect(computeSnap({ x: 130, y: 300, w: 10, h: 10 }, [{ x: 100, y: 0, w: 5, h: 5 }], 6)).toMatchObject({ dx: 0, dy: 0 });
  });
});

describe('ink recognition', () => {
  it('recognizes a straight stroke as a line', () => {
    const flat = Array.from({ length: 20 }, (_, i) => [i * 10, i * 2 + (i % 2)]).flat();
    expect(recognizeStroke(flat)?.kind).toBe('line');
  });
  it('recognizes a wobbly loop as a circle', () => {
    expect(recognizeStroke(circleStroke(100, 100, 60))?.kind).toBe('circle');
  });
  it('recognizes a closed box as a rectangle', () => {
    const r = recognizeStroke(rectStroke(0, 0, 200, 100));
    expect(r?.kind).toBe('rect');
  });
  it('leaves scribbles alone', () => {
    const scribble = [0, 0, 50, 80, 10, 20, 90, 10, 30, 70, 60, 5, 5, 60, 80, 90, 40, 0];
    expect(recognizeStroke(scribble)).toBeNull();
  });
});

describe('stacking order', () => {
  it('sorts by zIndex and keeps creation order for ties', () => {
    const els = [el('a'), el('b', { zIndex: 2 }), el('c'), el('d', { zIndex: -1 })];
    expect(sortByZ(els).map((e) => e.id)).toEqual(['d', 'a', 'c', 'b']);
  });
});
