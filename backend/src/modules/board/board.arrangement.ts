/**
 * Auto-arrangement service: calculates optimal positions for board elements.
 *
 * Strategy:
 * 1. Group connected elements
 * 2. Apply force-directed layout
 * 3. Avoid overlaps
 * 4. Maintain relationships
 */

interface Element {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  kind?: string;
  [key: string]: unknown;
}

interface Connection {
  from: string;
  to: string;
}

const SPACING = 80;
const GRID_SIZE = 20;

/**
 * Snaps a coordinate to the grid.
 */
function snap(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

/**
 * Checks if two rectangles overlap.
 */
function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * Extracts connections from elements.
 * Looks for connector elements that reference other elements.
 */
function extractConnections(elements: Element[]): Connection[] {
  const connections: Connection[] = [];

  for (const el of elements) {
    // Check for connector elements with from/to references
    if (el.kind === 'connector' || el.kind === 'arrow' || el.kind === 'line') {
      const from = typeof el.from === 'string' ? el.from : null;
      const to = typeof el.to === 'string' ? el.to : null;
      if (from && to) {
        connections.push({ from, to });
      }
    }

    // Check for explicit relationships array
    if (Array.isArray(el.relationships)) {
      for (const rel of el.relationships) {
        if (typeof rel === 'string') {
          connections.push({ from: el.id, to: rel });
        } else if (rel && typeof rel === 'object' && typeof (rel as { to?: unknown }).to === 'string') {
          connections.push({ from: el.id, to: (rel as { to: string }).to });
        }
      }
    }
  }

  return connections;
}

/**
 * Groups elements into connected clusters using union-find.
 */
function findClusters(elements: Element[], connections: Connection[]): Map<string, Set<string>> {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id);
    if (!p || p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootA, rootB);
  };

  // Initialize
  for (const el of elements) {
    parent.set(el.id, el.id);
  }

  // Union connected elements
  for (const conn of connections) {
    if (parent.has(conn.from) && parent.has(conn.to)) {
      union(conn.from, conn.to);
    }
  }

  // Group by root
  const clusters = new Map<string, Set<string>>();
  for (const el of elements) {
    const root = find(el.id);
    if (!clusters.has(root)) clusters.set(root, new Set());
    clusters.get(root)!.add(el.id);
  }

  return clusters;
}

/**
 * Calculates layout positions for a single cluster using force-directed placement.
 */
function layoutCluster(
  elementMap: Map<string, Element>,
  cluster: Set<string>,
  connections: Connection[],
  startX: number,
  startY: number,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const elements = Array.from(cluster).map((id) => elementMap.get(id)!).filter(Boolean);

  if (elements.length === 0) return positions;

  // Simple grid layout for small clusters
  if (elements.length <= 3) {
    elements.forEach((el, i) => {
      positions.set(el.id, {
        x: snap(startX + i * (el.width + SPACING)),
        y: snap(startY),
      });
    });
    return positions;
  }

  // Force-directed layout for larger clusters
  const clusterConnections = connections.filter(
    (c) => cluster.has(c.from) && cluster.has(c.to),
  );

  // Initialize positions in a circle
  const radius = Math.max(200, elements.length * 30);
  const angleStep = (2 * Math.PI) / elements.length;
  elements.forEach((el, i) => {
    const angle = i * angleStep;
    positions.set(el.id, {
      x: startX + Math.cos(angle) * radius,
      y: startY + Math.sin(angle) * radius,
    });
  });

  // Apply force-directed iterations
  const iterations = 50;
  const repulsion = 5000;
  const attraction = 0.1;
  const damping = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    elements.forEach((el) => forces.set(el.id, { fx: 0, fy: 0 }));

    // Repulsion between all elements
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i]!;
        const b = elements[j]!;
        const posA = positions.get(a.id)!;
        const posB = positions.get(b.id)!;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const distSq = dx * dx + dy * dy + 1;
        const force = repulsion / distSq;

        const fx = (dx / Math.sqrt(distSq)) * force;
        const fy = (dy / Math.sqrt(distSq)) * force;

        forces.get(a.id)!.fx -= fx;
        forces.get(a.id)!.fy -= fy;
        forces.get(b.id)!.fx += fx;
        forces.get(b.id)!.fy += fy;
      }
    }

    // Attraction along connections
    for (const conn of clusterConnections) {
      const posFrom = positions.get(conn.from);
      const posTo = positions.get(conn.to);
      if (!posFrom || !posTo) continue;

      const dx = posTo.x - posFrom.x;
      const dy = posTo.y - posFrom.y;
      const _dist = Math.sqrt(dx * dx + dy * dy) + 1;

      const fx = dx * attraction;
      const fy = dy * attraction;

      forces.get(conn.from)!.fx += fx;
      forces.get(conn.from)!.fy += fy;
      forces.get(conn.to)!.fx -= fx;
      forces.get(conn.to)!.fy -= fy;
    }

    // Apply forces
    elements.forEach((el) => {
      const pos = positions.get(el.id)!;
      const force = forces.get(el.id)!;
      pos.x += force.fx * damping;
      pos.y += force.fy * damping;
    });
  }

  // Snap to grid and normalize to start position
  const minX = Math.min(...Array.from(positions.values()).map((p) => p.x));
  const minY = Math.min(...Array.from(positions.values()).map((p) => p.y));

  positions.forEach((pos, _id) => {
    pos.x = snap(pos.x - minX + startX);
    pos.y = snap(pos.y - minY + startY);
  });

  return positions;
}

/**
 * Resolves overlaps by shifting elements.
 */
function resolveOverlaps(
  elements: Element[],
  positions: Map<string, { x: number; y: number }>,
): void {
  const maxIterations = 20;

  for (let iter = 0; iter < maxIterations; iter++) {
    let hasOverlap = false;

    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const a = elements[i]!;
        const b = elements[j]!;
        const posA = positions.get(a.id);
        const posB = positions.get(b.id);

        if (!posA || !posB) continue;

        const rectA = { x: posA.x, y: posA.y, width: a.width, height: a.height };
        const rectB = { x: posB.x, y: posB.y, width: b.width, height: b.height };

        if (overlaps(rectA, rectB)) {
          hasOverlap = true;

          // Shift apart
          const dx = rectB.x - rectA.x;
          const dy = rectB.y - rectA.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;

          const shiftX = ((dx / dist) * (a.width + SPACING)) / 2;
          const shiftY = ((dy / dist) * (a.height + SPACING)) / 2;

          posA.x = snap(posA.x - shiftX);
          posA.y = snap(posA.y - shiftY);
          posB.x = snap(posB.x + shiftX);
          posB.y = snap(posB.y + shiftY);
        }
      }
    }

    if (!hasOverlap) break;
  }
}

/**
 * Calculates new positions for all elements.
 */
export function arrangeElements(elements: Element[]): Map<string, { x: number; y: number }> {
  if (elements.length === 0) return new Map();

  // Extract connections and clusters
  const connections = extractConnections(elements);
  const elementMap = new Map(elements.map((el) => [el.id, el]));
  const clusters = findClusters(elements, connections);

  // Layout each cluster
  const allPositions = new Map<string, { x: number; y: number }>();
  let currentX = 100;
  let currentY = 100;
  let maxHeight = 0;

  for (const cluster of clusters.values()) {
    const clusterPositions = layoutCluster(elementMap, cluster, connections, currentX, currentY);

    // Merge into main positions
    clusterPositions.forEach((pos, id) => {
      allPositions.set(id, pos);
      const el = elementMap.get(id)!;
      maxHeight = Math.max(maxHeight, pos.y + el.height - currentY);
    });

    // Move to next cluster position
    currentX += 400;
    if (currentX > 1600) {
      currentX = 100;
      currentY += maxHeight + 200;
      maxHeight = 0;
    }
  }

  // Resolve overlaps
  resolveOverlaps(elements, allPositions);

  return allPositions;
}

export default { arrangeElements };
