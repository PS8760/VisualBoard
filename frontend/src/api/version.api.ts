import { client, apiErrorMessage } from './client';
import type { BoardVersion } from '../types';

interface BackendVersion {
  id: number;
  board_id: number;
  snapshot: Array<Record<string, unknown>> | null;
  created_by: number;
  created_at: string;
  users?: { id: number; name: string } | null;
}

function mapVersion(raw: BackendVersion): BoardVersion {
  const name = raw.users?.name ?? `User #${raw.created_by}`;
  const snapshot = Array.isArray(raw.snapshot) ? raw.snapshot : [];
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
    return (data?.data ?? []).map(mapVersion);
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

export async function restoreVersion(boardId: string, versionId: string) {
  try {
    await client.post(`/boards/${boardId}/versions/${versionId}/restore`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: apiErrorMessage(error) };
  }
}