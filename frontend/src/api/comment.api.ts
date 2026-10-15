import { client, apiErrorMessage } from './client';
import { colorForUser } from '../utils';
import type { CommentItem } from '../types';

export interface BackendComment {
  id: number;
  board_id: number;
  user_id: number;
  content: string;
  element_id?: string | null;
  x_position?: number | null;
  y_position?: number | null;
  created_at: string;
  updated_at: string;
  users?: { id: number; name: string; email: string; avatar?: string | null } | null;
  author?: { id: number; name: string; email: string; avatar?: string | null } | null;
}

export function mapComment(raw: BackendComment): CommentItem {
  const u = raw.users ?? raw.author;
  const authorId = String(u?.id ?? raw.user_id);
  return {
    id: String(raw.id),
    boardId: String(raw.board_id),
    elementId: raw.element_id ?? undefined,
    x: raw.x_position ?? undefined,
    y: raw.y_position ?? undefined,
    author: {
      id: authorId,
      name: u?.name ?? 'User',
      color: colorForUser(authorId),
    },
    text: raw.content,
    createdAt: raw.created_at,
  };
}

export async function fetchComments(boardId: string): Promise<CommentItem[]> {
  try {
    const { data } = await client.get<{ data?: BackendComment[] }>(`/boards/${boardId}/comments`);
    return (data?.data ?? []).map(mapComment);
  } catch {
    return [];
  }
}

export async function createComment(
  boardId: string,
  payload: { text: string; elementId?: string; x?: number; y?: number; clientId?: string },
): Promise<CommentItem | null> {
  try {
    const { data } = await client.post<{ data?: BackendComment }>(`/boards/${boardId}/comments`, {
      content: payload.text,
      element_id: payload.elementId,
      x: payload.x,
      y: payload.y,
      clientId: payload.clientId,
    });
    return data?.data ? mapComment(data.data) : null;
  } catch {
    return null;
  }
}

export async function deleteComment(boardId: string, commentId: string) {
  try {
    await client.delete(`/boards/${boardId}/comments/${commentId}`);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: apiErrorMessage(error) };
  }
}
