import type { BoardElement } from '../types';
import { elementBox, type Box } from './geometry';
import { renderSignature } from './fabric.elements';

export interface VersionDiff {
  /** On the board now, absent from the version (restoring removes them). */
  added: Box[];
  /** In the version, absent now (restoring brings them back). */
  removed: Box[];
  /** Present in both but different. */
  changed: Box[];
}

/** What restoring `snapshot` would change relative to `current`. */
export function computeVersionDiff(snapshot: BoardElement[], current: BoardElement[]): VersionDiff {
  const before = new Map(snapshot.filter((el) => el?.id).map((el) => [el.id, el] as const));
  const now = new Map(current.map((el) => [el.id, el] as const));
  const diff: VersionDiff = { added: [], removed: [], changed: [] };
  for (const [id, el] of now) {
    const old = before.get(id);
    if (!old) diff.added.push(elementBox(el));
    else if (renderSignature({ ...old, id }) !== renderSignature(el)) diff.changed.push(elementBox(el));
  }
  for (const [id, el] of before) {
    if (!now.has(id)) diff.removed.push(elementBox({ ...el, id }));
  }
  return diff;
}
