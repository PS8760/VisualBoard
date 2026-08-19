import { client, apiErrorMessage } from './client';

export interface AiSuggestion {
  id: string;
  title: string;
  detail: string;
  category: 'architecture' | 'security' | 'performance' | 'process' | 'product';
  priority: 'high' | 'medium' | 'low';
}

export interface SuggestionsResponse {
  suggestions: AiSuggestion[];
  model: string;
}

export async function fetchBoardSuggestions(
  boardId: string,
  prompt?: string,
): Promise<{ ok: boolean; data?: SuggestionsResponse; message?: string }> {
  try {
    const { data } = await client.post<{ data?: SuggestionsResponse }>(`/boards/${boardId}/suggestions`, {
      prompt: prompt ?? null,
    });
    if (data?.data) return { ok: true, data: data.data };
    return { ok: false, message: 'Suggestions endpoint returned no data' };
  } catch (error) {
    return { ok: false, message: apiErrorMessage(error) };
  }
}