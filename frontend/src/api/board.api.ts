import { client, apiErrorMessage } from './client';
import type { Board, BoardElement, User } from '../types';
import { initialsOf } from '../utils';

interface BackendBoard {
  id: number;
  title: string;
  description?: string | null;
  owner_id: number;
  created_at: string;
  updated_at: string;
  role?: User['role'];
  _count?: { elements?: number; comments?: number; documents?: number };
  elements?: Array<{ id: string; element_data: Record<string, unknown>; created_at?: string }>;
  board_members?: Array<{
    role: 'owner' | 'editor' | 'viewer';
    users: { id: number; name: string; email: string; avatar?: string | null };
  }>;
}

export interface BoardSummary {
  id: string;
  title: string;
  description?: string;
  ownerId: string;
  role: User['role'];
  createdAt: string;
  updatedAt: string;
  elementCount: number;
  commentCount: number;
  documentCount: number;
}

function mapMembers(members: BackendBoard['board_members'] = []): User[] {
  return members.map((m) => ({
    id: String(m.users.id),
    name: m.users.name,
    email: m.users.email,
    color: '#d9480f',
    initials: initialsOf(m.users.name),
    role: m.role,
  }));
}

export function mapBoard(raw: BackendBoard): Board {
  return {
    id: String(raw.id),
    title: raw.title,
    description: raw.description ?? undefined,
    ownerId: String(raw.owner_id),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    // The row id is authoritative; legacy rows don't repeat it inside element_data.
    elements: (raw.elements ?? []).map((el) => ({ ...(el.element_data as unknown as BoardElement), id: el.id })),
    members: mapMembers(raw.board_members),
  };
}

export async function fetchBoard(id: string): Promise<{ ok: boolean; board?: Board; message?: string }> {
  try {
    const { data } = await client.get<{ data?: BackendBoard }>(`/boards/${id}`);
    if (data?.data) {
      return { ok: true, board: mapBoard(data.data) };
    }
    return { ok: false, message: 'Board not found' };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function createBoard(title: string, description?: string): Promise<Board | null> {
  try {
    const { data } = await client.post<{ data?: BackendBoard }>('/boards', {
      title,
      description,
    });
    return data?.data ? mapBoard(data.data) : null;
  } catch {
    return null;
  }
}

export async function listBoards(): Promise<BoardSummary[]> {
  try {
    const { data } = await client.get<{ data?: BackendBoard[] }>('/boards');
    return (data?.data ?? []).map((b) => ({
      id: String(b.id),
      title: b.title,
      description: b.description ?? undefined,
      ownerId: String(b.owner_id),
      role: (b.role ?? 'viewer') as User['role'],
      createdAt: b.created_at,
      updatedAt: b.updated_at,
      elementCount: b._count?.elements ?? 0,
      commentCount: b._count?.comments ?? 0,
      documentCount: b._count?.documents ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function updateBoard(boardId: string, patch: { title?: string; description?: string | null }): Promise<{ ok: boolean; message?: string }> {
  try {
    const { data } = await client.put<{ data?: BackendBoard }>(`/boards/${boardId}`, patch);
    return data?.data ? { ok: true } : { ok: false, message: 'Board update failed' };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function deleteBoard(boardId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await client.delete(`/boards/${boardId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}
