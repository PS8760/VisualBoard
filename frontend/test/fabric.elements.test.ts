import { describe, expect, it } from 'vitest';
import { Path } from 'fabric';
import type { BoardElement } from '../src/types';
import {
  materializeElement,
  serializeElement,
  flattenPathPoints,
  asVB,
  elementId,
} from '../src/services/fabric.elements';

const penElement = (overrides: Partial<BoardElement> = {}): BoardElement => ({
  id: 'el_pen',
  kind: 'pen',
  x: 140,
  y: 200,
  width: 0,
  height: 0,
  rotation: 0,
  fill: 'transparent',
  stroke: '#1b1a17',
  strokeWidth: 2,
  content: '',
  version: 1,
  ...overrides,
});

describe('fabric element serialization round-trip', () => {
  it('materializes a pen path from flat points (demo format)', () => {
    const obj = materializeElement(
      penElement({ points: [-880, -270, -860, -255, -835, -252, -810, -246] }),
    );
    expect(obj).toBeInstanceOf(Path);
    expect(elementId(obj)).toBe('el_pen');
    expect(asVB(obj).data?.kind).toBe('pen');
  });

  it('serializes a pen path into stable id, flat points and a string path', () => {
    const obj = materializeElement(
      penElement({
        pointsToPath: JSON.stringify([
          ['M', 100, 200],
          ['Q', 120, 180, 140, 200],
          ['Q', 160, 220, 180, 200],
        ]),
      }),
    );
    const el = serializeElement(obj);
    expect(el).not.toBeNull();
    expect(el!.id).toBe('el_pen');
    expect(el!.kind).toBe('pen');
    expect(typeof el!.pointsToPath).toBe('string');
    expect(el!.pointsToPath).toBe(
      JSON.stringify([
        ['M', 100, 200],
        ['Q', 120, 180, 140, 200],
        ['Q', 160, 220, 180, 200],
      ]),
    );
    expect(el!.points).toEqual([100, 200, 120, 180, 140, 200, 160, 220, 180, 200]);
  });

  it('round-trips a pen stroke with identical bounding box', () => {
    const strokes: Array<[string, ...number[]]> = [
      ['M', 100, 200],
      ['Q', 120, 180, 140, 200],
      ['Q', 160, 220, 180, 200],
    ];
    const first = materializeElement(
      penElement({ pointsToPath: JSON.stringify(strokes) }),
    );
    const firstBox = first.getBoundingRect();

    const serialized = serializeElement(first)!;
    const second = materializeElement(penElement(serialized));
    const secondBox = second.getBoundingRect();

    expect(secondBox.left).toBeCloseTo(firstBox.left, 6);
    expect(secondBox.top).toBeCloseTo(firstBox.top, 6);
    expect(secondBox.width).toBeCloseTo(firstBox.width, 6);
    expect(secondBox.height).toBeCloseTo(firstBox.height, 6);
  });

  it('round-trips a moved pen stroke at the new position', () => {
    const strokes: Array<[string, ...number[]]> = [
      ['M', 100, 200],
      ['Q', 120, 180, 140, 200],
    ];
    const moved = materializeElement(
      penElement({ x: 300, y: 400, pointsToPath: JSON.stringify(strokes) }),
    );
    const box = moved.getBoundingRect();
    expect(box.left).not.toBe(0);

    const reloaded = materializeElement(
      penElement(serializeElement(moved)!),
    );
    const reloadedBox = reloaded.getBoundingRect();
    expect(reloadedBox.left).toBeCloseTo(box.left, 6);
    expect(reloadedBox.top).toBeCloseTo(box.top, 6);
    expect(reloadedBox.width).toBeCloseTo(box.width, 6);
    expect(reloadedBox.height).toBeCloseTo(box.height, 6);
  });

  it('serializes a rectangle with correct kind and position', () => {
    const obj = materializeElement({
      id: 'el_r',
      kind: 'rect',
      x: 10,
      y: 20,
      width: 100,
      height: 60,
      rotation: 0,
      fill: '#fafaf8',
      stroke: '#c2c0b5',
      strokeWidth: 1.5,
      radius: 8,
      content: '',
      version: 1,
    });
    const el = serializeElement(obj);
    expect(el).not.toBeNull();
    expect(el!.kind).toBe('rect');
    expect(el!.id).toBe('el_r');
    expect(el!.width).toBe(100);
    expect(el!.height).toBe(60);
  });

  it('flattens path segments into a point list', () => {
    const segments = [
      ['M', 1, 2],
      ['L', 3, 4],
      ['Q', 5, 6, 7, 8],
      ['Z'],
    ];
    expect(flattenPathPoints(segments)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('serializes a pen element without a data id as null (defensive)', () => {
    const raw = materializeElement(
      penElement({ pointsToPath: JSON.stringify([['M', 0, 0]]) }),
    );
    asVB(raw).data = {};
    expect(serializeElement(raw)).toBeNull();
  });
});