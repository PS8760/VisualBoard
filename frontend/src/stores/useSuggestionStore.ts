import { create } from 'zustand';
import type { Suggestion } from '../types';
import { demoSuggestions } from '../data/demo';

interface SuggestionState {
  suggestions: Suggestion[];
  panelVisible: boolean;
  dismissed: Set<string>;
  applied: Set<string>;
  lastEvaluated: number;

  evaluate: (items: Suggestion[]) => void;
  showPanel: () => void;
  hidePanel: () => void;
  dismiss: (id: string) => void;
  apply: (id: string) => void;
  reset: () => void;
}

export const useSuggestionStore = create<SuggestionState>((set, get) => ({
  suggestions: demoSuggestions,
  panelVisible: true,
  dismissed: new Set(),
  applied: new Set(),
  lastEvaluated: 0,

  evaluate: (suggestions) => {
    const { dismissed, applied } = get();
    const fresh = suggestions.filter(
      (s) => !dismissed.has(s.id) && !applied.has(s.id),
    );
    set({
      suggestions: fresh,
      lastEvaluated: Date.now(),
      panelVisible: fresh.length > 0,
    });
  },

  showPanel: () => set({ panelVisible: true }),
  hidePanel: () => set({ panelVisible: false }),
  dismiss: (id) =>
    set((s) => ({ dismissed: new Set(s.dismissed).add(id), suggestions: s.suggestions.filter((x) => x.id !== id) })),
  apply: (id) =>
    set((s) => ({ applied: new Set(s.applied).add(id), suggestions: s.suggestions.filter((x) => x.id !== id) })),
  reset: () =>
    set({ suggestions: demoSuggestions, panelVisible: true, dismissed: new Set(), applied: new Set() }),
}));
