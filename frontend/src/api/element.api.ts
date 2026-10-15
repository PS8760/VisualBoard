import { client, apiErrorMessage } from './client';
import type { BoardElement } from '../types';

/**
 * REST access to elements. Live editing persists through the realtime
 * channel (see services/realtime.ts); REST is used for the authoritative
 * resync after reconnects and for scripted/bulk use.
 */

interface BackendElementRow {
  id: string;
  element_data: Record<string, unknown>;
}

export function mapElementRow(row: BackendElementRow): BoardElement {
  return { ...(row.element_data as unknown as BoardElement), id: row.id };
}

export async function fetchElements(
  boardId: string,
): Promise<{ ok: true; elements: BoardElement[] } | { ok: false; message: string }> {
  try {
    const { data } = await client.get<{ data?: BackendElementRow[] }>(`/boards/${boardId}/elements`);
    return { ok: true, elements: (data?.data ?? []).map(mapElementRow) };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}

/** Full replace. Destructive for concurrent editors — not used by the live editor. */
export async function saveElements(boardId: string, elements: BoardElement[]) {
  try {
    await client.put(`/boards/${boardId}/elements/bulk`, { elements });
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: apiErrorMessage(error) };
  }
}
