import { client, apiErrorMessage } from './client';
import type { User } from '../types';
import { initialsOf } from '../utils';

const ROLE_COLORS: Record<User['role'], string> = {
  owner: '#d9480f',
  editor: '#3a2c16',
  viewer: '#78716c',
};

export interface SearchResult {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

function mapUser(raw: {
  id: number;
  name: string;
  email: string;
  avatar?: string | null;
  role?: User['role'];
  color?: string;
  initials?: string;
}): User {
  return {
    id: String(raw.id),
    name: raw.name,
    email: raw.email,
    color: raw.color ?? ROLE_COLORS[raw.role ?? 'viewer'],
    initials: raw.initials ?? initialsOf(raw.name),
    role: raw.role ?? 'viewer',
    avatar: raw.avatar ?? null,
  };
}

export async function fetchMe(): Promise<User | null> {
  try {
    const { data } = await client.get<{ data?: { id: number; name: string; email: string; avatar?: string | null; provider?: string | null } }>('/users/me');
    if (!data?.data) return null;
    return mapUser(data.data);
  } catch {
    return null;
  }
}

export async function updateProfile(patch: { name?: string; avatar?: string | null }): Promise<{ ok: boolean; user?: User; message?: string }> {
  try {
    const { data } = await client.put<{ data?: { id: number; name: string; email: string; avatar?: string | null } }>('/users/me', patch);
    if (data?.data) return { ok: true, user: mapUser(data.data) };
    return { ok: false, message: 'Could not update profile' };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const { data } = await client.post<{ data?: { updated: boolean } }>('/users/me/password', {
      currentPassword,
      newPassword,
    });
    if (data?.data?.updated) return { ok: true };
    return { ok: false, message: 'Password was not changed' };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function uploadAvatar(file: File): Promise<{ ok: boolean; avatar?: string; message?: string }> {
  try {
    const form = new FormData();
    form.append('avatar', file);
    const { data } = await client.post<{ data?: { avatar?: string } }>('/users/me/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    if (data?.data?.avatar) return { ok: true, avatar: data.data.avatar };
    return { ok: false, message: 'Avatar upload failed' };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function searchUsers(email: string): Promise<SearchResult[]> {
  try {
    const { data } = await client.get<{ data?: SearchResult[] }>('/users/search', { params: { email } });
    return (data?.data ?? []).map((r) => ({ ...r, id: String(r.id) }));
  } catch {
    return [];
  }
}

export async function fetchBoardMembers(boardId: string): Promise<User[]> {
  try {
    const { data } = await client.get<{ data?: Array<{ user_id: number; role: User['role']; user: { id: number; name: string; email: string; avatar?: string | null } }> }>(
      `/boards/${boardId}/members`,
    );
    return (data?.data ?? []).map((m) =>
      mapUser({ ...m.user, role: m.role }),
    );
  } catch {
    return [];
  }
}

export async function inviteMember(boardId: string, email: string, role: User['role']): Promise<{ ok: boolean; message?: string }> {
  try {
    await client.post(`/boards/${boardId}/members/invite`, { email, role });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function updateMemberRole(boardId: string, userId: string, role: User['role']): Promise<{ ok: boolean; message?: string }> {
  try {
    await client.put(`/boards/${boardId}/members/${userId}`, { role });
    return { ok: true };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

export async function removeMember(boardId: string, userId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await client.delete(`/boards/${boardId}/members/${userId}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}