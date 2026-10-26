import { useEffect, useMemo } from 'react';
import { useBoardStore } from '../stores/useBoardStore';
import { useSuggestionStore } from '../stores/useSuggestionStore';
import { analyzeBoard } from '../services/suggestions';

/** Live local analysis of the open board, minus this board's dismissals. */
export function useBoardSuggestions() {
  const elements = useBoardStore((s) => s.board?.elements);
  const boardId = useBoardStore((s) => s.board?.id);
  const dismissed = useSuggestionStore((s) => s.dismissed);
  useEffect(() => {
    if (boardId) useSuggestionStore.getState().setBoard(boardId);
  }, [boardId]);
  const analysis = useMemo(() => analyzeBoard(elements ?? []), [elements]);
  const visible = useMemo(() => analysis.suggestions.filter((s) => !dismissed.has(s.id)), [analysis, dismissed]);
  const hidden = analysis.suggestions.length - visible.length;
  return { analysis, visible, hidden };
}
