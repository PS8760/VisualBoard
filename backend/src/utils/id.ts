import { randomBytes } from 'node:crypto';

/** Short collision-resistant client id, e.g. "el_8f3k2". */
export function uid(prefix = 'id'): string {
  return `${prefix}_${randomBytes(4).toString('hex')}`;
}

export default uid;