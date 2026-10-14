import { create } from 'zustand';
import type { Tool } from '../types';

export type ShapeTool = 'rect' | 'circle' | 'line' | 'arrow';
export const SHAPE_TOOLS: ShapeTool[] = ['rect', 'circle', 'line', 'arrow'];

interface ToolState {
  tool: Tool;
  previousTool: Tool;
  penWidth: number;
  penColor: string;
  /** Highlighter strokes are wide and translucent. */
  penMode: 'pen' | 'highlighter';
  /** Always convert recognizable strokes into clean shapes (holding still does it per stroke). */
  autoShape: boolean;
  /** Shape shown on the dock's shapes button (last one used). */
  shapeTool: ShapeTool;
  /** Routing for new connectors: auto = elbow between two shapes, straight otherwise. */
  connectorRouting: 'auto' | 'straight' | 'curved' | 'elbow';
  setConnectorRouting: (r: 'auto' | 'straight' | 'curved' | 'elbow') => void;
  setTool: (tool: Tool) => void;
  setPenWidth: (width: number) => void;
  setPenColor: (color: string) => void;
  setPenMode: (mode: 'pen' | 'highlighter') => void;
  setAutoShape: (on: boolean) => void;
  /** Returns to previous non-hand tool after temporary pan */
  restoreTool: () => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  tool: 'select',
  previousTool: 'select',
  penWidth: 3,
  penColor: '#1b1a17',
  penMode: 'pen',
  autoShape: false,
  shapeTool: 'rect',
  connectorRouting: 'auto',
  setConnectorRouting: (connectorRouting) => set({ connectorRouting }),

  setTool: (tool) => {
    if (tool === get().tool) return;
    if (tool !== 'hand') set({ previousTool: tool });
    if ((['rect', 'circle', 'line', 'arrow'] as Tool[]).includes(tool)) set({ shapeTool: tool as ShapeTool });
    set({ tool });
  },

  setPenWidth: (penWidth) => set({ penWidth }),
  setPenColor: (penColor) => set({ penColor }),
  setPenMode: (penMode) => set({ penMode }),
  setAutoShape: (autoShape) => set({ autoShape }),

  restoreTool: () => set({ tool: get().previousTool }),
}));
