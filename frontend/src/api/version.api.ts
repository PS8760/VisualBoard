import { client, apiErrorMessage } from './client';
import type { BoardElement, BoardVersion } from '../types';

interface BackendVersion {
  id: number;
  board_id: number;
  label?: string | null;
  /** Present on the timeline listing (metadata only). */
  element_count?: number;
  /** Present when a single version is fetched. Historically an array or `{ elements }`. */
  snapshot?: unknown;
  created_by: number;
  created_at: string;
  users?: { id: number; name: string } | null;
}

function snapshotLength(raw: BackendVersion): number {
  if (typeof raw.element_count === 'number') return raw.element_count;
  const s = raw.snapshot;
  if (Array.isArray(s)) return s.length;
  if (s && typeof s === 'object' && Array.isArray((s as { elements?: unknown }).elements)) {
    return (s as { elements: unknown[] }).elements.length;
  }
  return 0;
}

export function mapVersion(raw: BackendVersion): BoardVersion {
  const count = snapshotLength(raw);
  const kind = raw.label ?? 'Snapshot';
  return {
    id: String(raw.id),
    label: `#${raw.id} · ${kind}`,
    kind,
    timestamp: raw.created_at,
    author: raw.users?.name ?? `User #${raw.created_by}`,
    description: `Board state with ${count} element${count === 1 ? '' : 's'}`,
    elementCount: count,
  };
}

/** Newest first, exactly as the API returns them. */
export async function fetchVersions(boardId: string): Promise<BoardVersion[]> {
  try {
    const { data } = await client.get<{ data?: BackendVersion[] }>(`/boards/${boardId}/versions`);
    // Hide empty snapshots — restoring one is refused server-side anyway.
    return (data?.data ?? []).map(mapVersion).filter((v) => v.elementCount > 0);
  } catch {
    return [];
  }
}

export async function createVersion(boardId: string, label?: string): Promise<BoardVersion | null> {
  try {
    const { data } = await client.post<{ data?: BackendVersion }>(`/boards/${boardId}/versions`, label ? { label } : {});
    return data?.data ? mapVersion(data.data) : null;
  } catch {
    return null;
  }
}

export async function restoreVersion(
  boardId: string,
  versionId: string,
): Promise<{ ok: true; elements: BoardElement[] } | { ok: false; message: string }> {
  try {
    const { data } = await client.post<{ data?: { elements?: BoardElement[] } }>(
      `/boards/${boardId}/versions/${versionId}/restore`,
    );
    return { ok: true, elements: data?.data?.elements ?? [] };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}
