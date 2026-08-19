import type { BoardElement } from '../types';

export interface ArrangeTarget {
  id: string;
  x?: number;
  y?: number;
  points?: number[];
}

const NODE_KINDS: BoardElement['kind'][] = ['rect', 'circle', 'sticky', 'text', 'image', 'document'];
const CONNECTOR_KINDS: BoardElement['kind'][] = ['line', 'arrow'];

interface Box {
  id: string;
  kind: BoardElement['kind'];
  cx: number;
  cy: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function boxOf(el: BoardElement): Box {
  return {
    id: el.id,
    kind: el.kind,
    cx: el.x + el.width / 2,
    cy: el.y + el.height / 2,
    left: el.x,
    top: el.y,
    right: el.x + el.width,
    bottom: el.y + el.height,
  };
}

export function computeArrange(elements: BoardElement[]): ArrangeTarget[] {
  if (!elements.length) return [];

  const nodes = elements.filter((el) => NODE_KINDS.includes(el.kind));
  const connectors = elements.filter((el) => CONNECTOR_KINDS.includes(el.kind));
  const fixed = elements.filter((el) => el.kind === 'comment' || el.kind === 'pen');
  const targets: ArrangeTarget[] = [];

  if (!nodes.length) return [];

  const boxes = nodes.map(boxOf);
  const centerX = boxes.reduce((sum, b) => sum + b.cx, 0) / boxes.length;
  const centerY = boxes.reduce((sum, b) => sum + b.cy, 0) / boxes.length;

  const stickies = nodes.filter((el) => el.kind === 'sticky');
  const regular = nodes.filter((el) => el.kind !== 'sticky');

  const COLS = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(regular.length * 1.6))));
  const CELL_W = 250;
  const CELL_H = 150;
  const PAD = 80;
  const rows = Math.ceil(regular.length / COLS);

  const layoutStartX = centerX - ((COLS - 1) * CELL_W) / 2;
  const layoutStartY = centerY - ((rows - 1) * CELL_H) / 2;

  const gridTargets = new Map<string, { x: number; y: number }>();

  regular.forEach((el, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    gridTargets.set(el.id, {
      x: layoutStartX + col * CELL_W - el.width / 2,
      y: layoutStartY + row * CELL_H - el.height / 2,
    });
  });

  const maxGridRight = Math.max(
    ...Array.from(gridTargets.values()).map(
      (t, i) => t.x + (regular[i]?.width ?? 0),
    ),
    0,
  );

  stickies.forEach((el, i) => {
    const col = Math.floor(i / Math.max(1, Math.round(Math.sqrt(stickies.length))));
    const row = i % Math.max(1, Math.round(Math.sqrt(stickies.length)));
    gridTargets.set(el.id, {
      x: maxGridRight + PAD + col * 240,
      y: layoutStartY + row * 160,
    });
  });

  const oldBoxes = new Map(boxes.map((b) => [b.id, b]));

  for (const el of regular) {
    const t = gridTargets.get(el.id);
    if (t) targets.push({ id: el.id, x: t.x, y: t.y });
  }
  for (const el of stickies) {
    const t = gridTargets.get(el.id);
    if (t) targets.push({ id: el.id, x: t.x, y: t.y });
  }

  for (const conn of connectors) {
    const pts = conn.points ? [...conn.points] : [];
    if (pts.length >= 2) {
      const endpoints = [
        { i: 0, x: pts[0], y: pts[1] },
        { i: 2, x: pts[pts.length - 2], y: pts[pts.length - 1] },
      ];
      let moved = false;
      for (const ep of endpoints) {
        for (const [elId, oldBox] of oldBoxes) {
          const isEndpointNear =
            Math.abs(ep.x - oldBox.cx) < Math.max(oldBox.right - oldBox.left, 100) / 2 + 30 &&
            Math.abs(ep.y - oldBox.cy) < Math.max(oldBox.bottom - oldBox.top, 80) / 2 + 30;
          if (!isEndpointNear) continue;
          const t = gridTargets.get(elId);
          if (!t) continue;
          const deltaX = t.x + (oldBox.right - oldBox.left) / 2 - oldBox.cx;
          const deltaY = t.y + (oldBox.bottom - oldBox.top) / 2 - oldBox.cy;
          pts[ep.i] = ep.x + deltaX;
          pts[ep.i + 1] = ep.y + deltaY;
          moved = true;
          break;
        }
      }
      if (moved) targets.push({ id: conn.id, points: pts });
    }
  }

  fixed.forEach((el) => targets.push({ id: el.id }));

  return targets;
}
