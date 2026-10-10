import { client, apiErrorMessage } from './client';
import type { BoardVersion } from '../types';

interface BackendVersion {
  id: number;
  board_id: number;
  // Historically stored either as a bare array or as `{ elements: [...] }`.
  snapshot: unknown;
  created_by: number;
  created_at: string;
  users?: { id: number; name: string } | null;
}

function snapshotElements(raw: BackendVersion): Array<Record<string, unknown>> {
  const s = raw.snapshot;
  if (Array.isArray(s)) return s as Array<Record<string, unknown>>;
  if (s && typeof s === 'object' && Array.isArray((s as { elements?: unknown }).elements)) {
    return (s as { elements: Array<Record<string, unknown>> }).elements;
  }
  return [];
}

function mapVersion(raw: BackendVersion): BoardVersion {
  const name = raw.users?.name ?? `User #${raw.created_by}`;
  const snapshot = snapshotElements(raw);
  return {
    id: String(raw.id),
    label: `Snapshot ${raw.id}`,
    timestamp: raw.created_at,
    author: name,
    description: `Board state with ${snapshot.length} element${snapshot.length === 1 ? '' : 's'}`,
    elementCount: snapshot.length,
  };
}

export async function fetchVersions(boardId: string): Promise<BoardVersion[]> {
  try {
    const { data } = await client.get<{ data?: BackendVersion[] }>(`/boards/${boardId}/versions`);
    // Hide empty/broken snapshots — restoring one used to wipe the board.
    return (data?.data ?? []).map(mapVersion).filter((v) => v.elementCount > 0);
  } catch {
    return [];
  }
}

export async function createVersion(boardId: string): Promise<BoardVersion | null> {
  try {
    const { data } = await client.post<{ data?: BackendVersion }>(`/boards/${boardId}/versions`, {});
    return data?.data ? mapVersion(data.data) : null;
  } catch {
    return null;
  }
}

export async function restoreVersion(versionId: string) {
  try {
    await client.post(`/versions/${versionId}/restore`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: apiErrorMessage(error) };
  }
}