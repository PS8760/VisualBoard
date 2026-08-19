import { describe, it, expect } from 'vitest';
import { arrangeElements } from '../../src/modules/board/board.arrangement.js';

describe('Board Arrangement', () => {
  it('should handle empty elements', () => {
    const result = arrangeElements([]);
    expect(result.size).toBe(0);
  });

  it('should arrange single element', () => {
    const elements = [
      { id: 'el1', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
    ];
    const result = arrangeElements(elements);
    expect(result.size).toBe(1);
    expect(result.has('el1')).toBe(true);
  });

  it('should arrange multiple disconnected elements', () => {
    const elements = [
      { id: 'el1', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
      { id: 'el2', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
      { id: 'el3', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
    ];
    const result = arrangeElements(elements);
    expect(result.size).toBe(3);
    
    // All elements should have positions
    expect(result.has('el1')).toBe(true);
    expect(result.has('el2')).toBe(true);
    expect(result.has('el3')).toBe(true);
    
    // Positions should be snapped to grid (multiples of 20)
    const pos1 = result.get('el1')!;
    const pos2 = result.get('el2')!;
    const pos3 = result.get('el3')!;
    
    expect(pos1.x % 20).toBe(0);
    expect(pos1.y % 20).toBe(0);
    expect(pos2.x % 20).toBe(0);
    expect(pos2.y % 20).toBe(0);
    expect(pos3.x % 20).toBe(0);
    expect(pos3.y % 20).toBe(0);
  });

  it('should avoid overlaps', () => {
    const elements = [
      { id: 'el1', x: 100, y: 100, width: 100, height: 100, kind: 'rect' },
      { id: 'el2', x: 100, y: 100, width: 100, height: 100, kind: 'rect' }, // Same position
    ];
    const result = arrangeElements(elements);
    
    const pos1 = result.get('el1')!;
    const pos2 = result.get('el2')!;
    
    // Elements should not overlap
    const noOverlap =
      pos1.x + 100 <= pos2.x ||
      pos2.x + 100 <= pos1.x ||
      pos1.y + 100 <= pos2.y ||
      pos2.y + 100 <= pos1.y;
    
    expect(noOverlap).toBe(true);
  });

  it('should handle connected elements', () => {
    const elements = [
      { id: 'el1', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
      { id: 'el2', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
      {
        id: 'conn1',
        x: 0,
        y: 0,
        width: 50,
        height: 2,
        kind: 'connector',
        from: 'el1',
        to: 'el2',
      },
    ];
    const result = arrangeElements(elements);
    expect(result.size).toBe(3);
    
    // Connected elements should be in the same cluster
    const pos1 = result.get('el1')!;
    const pos2 = result.get('el2')!;
    
    // They should be relatively close (within reasonable distance)
    const distance = Math.sqrt(
      Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2),
    );
    expect(distance).toBeLessThan(1000);
  });

  it('should handle multiple clusters', () => {
    const elements = [
      // Cluster 1
      { id: 'el1', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
      { id: 'el2', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
      {
        id: 'conn1',
        x: 0,
        y: 0,
        width: 50,
        height: 2,
        kind: 'connector',
        from: 'el1',
        to: 'el2',
      },
      // Cluster 2 (disconnected)
      { id: 'el3', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
      { id: 'el4', x: 0, y: 0, width: 100, height: 100, kind: 'rect' },
    ];
    const result = arrangeElements(elements);
    expect(result.size).toBe(5);
    
    // All elements should have positions
    elements.forEach((el) => {
      expect(result.has(el.id)).toBe(true);
    });
  });

  it('should snap positions to grid', () => {
    const elements = [
      { id: 'el1', x: 123, y: 456, width: 100, height: 100, kind: 'rect' },
    ];
    const result = arrangeElements(elements);
    const pos = result.get('el1')!;
    
    // Should be multiples of 20
    expect(pos.x % 20).toBe(0);
    expect(pos.y % 20).toBe(0);
  });
});
