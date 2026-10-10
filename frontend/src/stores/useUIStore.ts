import { create } from 'zustand';
import type { PanelTab } from '../types';

interface UIState {
  rightPanelOpen: boolean;
  rightPanelTab: PanelTab;
  commandPaletteOpen: boolean;
  versionTimelineOpen: boolean;
  documentPreview: { id: string; name: string; type: string; size: number; uploadedAt: string; url?: string } | null;
  activeComment: { elementId: string; x: number; y: number } | null;
  arrangeComplete: boolean;
  arrangeAnalyzing: boolean;
  shortcutTooltip: string | null;

  toggleRightPanel: () => void;
  setRightPanel: (open: boolean) => void;
  setRightPanelTab: (tab: PanelTab) => void;
  setCommandPalette: (open: boolean) => void;
  setVersionTimeline: (open: boolean) => void;
  setDocumentPreview: (doc: UIState['documentPreview']) => void;
  setActiveComment: (c: UIState['activeComment']) => void;
  setArrangeComplete: (v: boolean) => void;
  setArrangeAnalyzing: (v: boolean) => void;
  setShortcutTooltip: (s: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  rightPanelOpen: false,
  rightPanelTab: 'info',
  commandPaletteOpen: false,
  versionTimelineOpen: false,
  documentPreview: null,
  activeComment: null,
  arrangeComplete: false,
  arrangeAnalyzing: false,
  shortcutTooltip: null,

  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanel: (rightPanelOpen) => set({ rightPanelOpen }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab, rightPanelOpen: true }),
  setCommandPalette: (commandPaletteOpen) => set({ commandPaletteOpen }),
  setVersionTimeline: (versionTimelineOpen) => set({ versionTimelineOpen }),
  setDocumentPreview: (documentPreview) => set({ documentPreview }),
  setActiveComment: (activeComment) => set({ activeComment }),
  setArrangeComplete: (arrangeComplete) => set({ arrangeComplete }),
  setArrangeAnalyzing: (arrangeAnalyzing) => set({ arrangeAnalyzing }),
  setShortcutTooltip: (shortcutTooltip) => set({ shortcutTooltip }),
}));
