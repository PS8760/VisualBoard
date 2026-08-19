import { client, apiErrorMessage } from './client';
import type { BoardElement } from '../types';

const ok = (error: unknown): { ok: boolean; message?: string } =>
  error ? { ok: false, message: apiErrorMessage(error) } : { ok: true };

export async function saveElements(boardId: string, elements: BoardElement[]) {
  try {
    await client.put(`/boards/${boardId}/elements/bulk`, { elements });
    return { ok: true as const };
  } catch (error) {
    return ok(error);
  }
}

export async function addElement(boardId: string, element: BoardElement) {
  try {
    await client.post(`/boards/${boardId}/elements`, { element });
    return { ok: true as const };
  } catch (error) {
    return ok(error);
  }
}

export async function updateElement(boardId: string, elementId: string, patch: Partial<BoardElement>) {
  try {
    await client.patch(`/boards/${boardId}/elements/${elementId}`, { patch });
    return { ok: true as const };
  } catch (error) {
    return ok(error);
  }
}

export async function deleteElement(boardId: string, elementId: string) {
  try {
    await client.delete(`/boards/${boardId}/elements/${elementId}`);
    return { ok: true as const };
  } catch (error) {
    return ok(error);
  }
}
