import { isTest } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

/**
 * Debounced automatic version snapshots.
 *
 * Every persisted element mutation calls `noteBoardMutation`. A snapshot is
 * taken once the board has been idle for IDLE_MS, and at least every MAX_WAIT_MS
 * during continuous editing, so the timeline captures meaningful checkpoints
 * without writing a full snapshot per keystroke. The writer itself skips
 * snapshots identical to the latest one and prunes old rows (see
 * version.service), which keeps storage bounded.
 *
 * Timers are per process. With several API instances each instance snapshots
 * the boards it served writes for; dedupe-by-content keeps that idempotent.
 */
const IDLE_MS = 30_000;
const MAX_WAIT_MS = 3 * 60_000;

type Pending = { timer: NodeJS.Timeout; firstAt: number; userId: number };

const pending = new Map<number, Pending>();

type SnapshotWriter = (boardId: number, userId: number) => Promise<unknown>;
let writer: SnapshotWriter | null = null;

/** Registered by version.service to avoid a circular import. */
export function registerSnapshotWriter(fn: SnapshotWriter) {
  writer = fn;
}

let enabled = !isTest;

/** Tests opt in explicitly; production/dev have it on. */
export function setAutoSnapshotEnabled(value: boolean) {
  enabled = value;
}

export function noteBoardMutation(boardId: number, userId?: number) {
  if (!enabled || !userId) return;
  const now = Date.now();
  const existing = pending.get(boardId);
  const firstAt = existing?.firstAt ?? now;
  if (existing) clearTimeout(existing.timer);

  const delay = Math.max(0, Math.min(IDLE_MS, firstAt + MAX_WAIT_MS - now));
  const timer = setTimeout(() => void flushBoard(boardId), delay);
  timer.unref();
  pending.set(boardId, { timer, firstAt, userId });
}

export async function flushBoard(boardId: number) {
  const entry = pending.get(boardId);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(boardId);
  if (!writer) return;
  try {
    await writer(boardId, entry.userId);
  } catch (err) {
    // The board may have been deleted meanwhile — never crash the process.
    logger.warn({ err, boardId }, 'auto snapshot failed');
  }
}

/** Flushes every pending snapshot (graceful shutdown). */
export async function flushAllSnapshots() {
  await Promise.all([...pending.keys()].map((boardId) => flushBoard(boardId)));
}

export function cancelBoardSnapshot(boardId: number) {
  const entry = pending.get(boardId);
  if (!entry) return;
  clearTimeout(entry.timer);
  pending.delete(boardId);
}
