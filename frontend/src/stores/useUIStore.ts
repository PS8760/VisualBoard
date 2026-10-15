import { create } from 'zustand';
import type { PanelTab } from '../types';

interface UIState {
  rightPanelOpen: boolean;
  rightPanelTab: PanelTab;
  commandPaletteOpen: boolean;
  versionTimelineOpen: boolean;
  documentPreview: { id: string; name: string; type: string; size: number; uploadedAt: string; url?: string } | null;
  /**
   * Open comment thread / composer. Anchored in WORLD coordinates (or to an
   * element) so it stays glued to the canvas while panning and zooming.
   */
  activeComment: { elementId?: string; x: number; y: number } | null;
  arrangeComplete: boolean;
  arrangeAnalyzing: boolean;
  shortcutTooltip: string | null;
  /** Hides all chrome for a distraction-free canvas. */
  zen: boolean;
  minimapVisible: boolean;
  /** Presence id of the collaborator whose pointer the viewport follows. */
  followingId: string | null;
  /** Visual diff of a version against the current board (world-space boxes). */
  versionDiff: {
    label: string;
    added: Array<{ x: number; y: number; w: number; h: number }>;
    removed: Array<{ x: number; y: number; w: number; h: number }>;
    changed: Array<{ x: number; y: number; w: number; h: number }>;
  } | null;

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
  setZen: (zen: boolean) => void;
  setMinimapVisible: (v: boolean) => void;
  setFollowing: (id: string | null) => void;
  setVersionDiff: (diff: UIState['versionDiff']) => void;
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
  zen: false,
  minimapVisible: true,
  followingId: null,
  versionDiff: null,

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
  setZen: (zen) => set({ zen }),
  setMinimapVisible: (minimapVisible) => set({ minimapVisible }),
  setFollowing: (followingId) => set({ followingId }),
  setVersionDiff: (versionDiff) => set({ versionDiff }),
}));
