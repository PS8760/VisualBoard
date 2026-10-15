/**
 * Laser pointer: ephemeral, fading trails for presenting. Local strokes are
 * drawn immediately and relayed to collaborators over the socket (volatile —
 * never persisted). Each collaborator's trail fades out over FADE_MS.
 */

export const FADE_MS = 1100;

export interface LaserPoint {
  x: number;
  y: number;
  t: number;
}

export interface LaserTrail {
  id: string;
  color: string;
  name?: string;
  points: LaserPoint[];
}

const trails = new Map<string, LaserTrail>();
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((fn) => fn());

export function onLaserChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function addLaserPoint(id: string, color: string, point: { x: number; y: number }, name?: string, breakStroke = false) {
  const now = performance.now();
  let trail = trails.get(id);
  if (!trail) {
    trail = { id, color, name, points: [] };
    trails.set(id, trail);
  }
  trail.color = color;
  if (name) trail.name = name;
  // NaN marks a pen-up so separate strokes are not joined.
  if (breakStroke && trail.points.length) trail.points.push({ x: NaN, y: NaN, t: now });
  trail.points.push({ x: point.x, y: point.y, t: now });
  notify();
}

/** Drops faded points; returns the live trails for rendering. */
export function liveTrails(now = performance.now()): LaserTrail[] {
  for (const [id, trail] of trails) {
    trail.points = trail.points.filter((p) => now - p.t < FADE_MS);
    if (!trail.points.length) trails.delete(id);
  }
  return [...trails.values()];
}

export function clearLaser() {
  trails.clear();
  notify();
}

/** Outbound relay — wired by the presence store when a live socket exists. */
let sender: ((p: { x: number; y: number; start?: boolean }) => void) | null = null;
export function setLaserSender(fn: typeof sender) {
  sender = fn;
}
export function sendLaserPoint(p: { x: number; y: number; start?: boolean }) {
  sender?.(p);
}
