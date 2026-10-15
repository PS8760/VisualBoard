import type { BoardElement } from '../../types';

/**
 * Content seeded onto a brand-new board so the first visit feels alive.
 * A small flow: Client → API → Database with notes and a comment.
 */
export const INITIAL_ELEMENTS: BoardElement[] = [
  {
    id: 'seed_1', kind: 'rect', x: -560, y: -120, width: 170, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'Client', version: 1,
  },
  {
    id: 'seed_2', kind: 'rect', x: -300, y: -120, width: 180, height: 60, rotation: 0,
    fill: '#fdf3ec', stroke: '#d9480f', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'API', version: 1,
  },
  {
    id: 'seed_3', kind: 'rect', x: -40, y: -120, width: 180, height: 60, rotation: 0,
    fill: '#fafaf8', stroke: '#c2c0b5', strokeWidth: 1.5, radius: 8, fontSize: 14,
    content: 'Database', version: 1,
  },
  {
    id: 'seed_4', kind: 'sticky', x: 120, y: -200, width: 200, height: 110, rotation: -2,
    fill: '#fdeeb0', stroke: '#e6cf74', strokeWidth: 1, fontSize: 13,
    content: 'Sketch the flow first — labels can wait.', version: 1,
  },
  {
    id: 'seed_6', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-390, -90, -300, -90], version: 1,
  },
  {
    id: 'seed_7', kind: 'arrow', x: 0, y: 0, width: 0, height: 0, rotation: 0,
    fill: 'transparent', stroke: '#a8a69c', strokeWidth: 1.5, content: '',
    points: [-120, -90, -40, -90], version: 1,
  },
];
