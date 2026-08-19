import { create } from 'zustand';
import type { Tool } from '../types';

interface ToolState {
  tool: Tool;
  previousTool: Tool;
  setTool: (tool: Tool) => void;
  /** Returns to previous non-hand tool after temporary pan */
  restoreTool: () => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  tool: 'select',
  previousTool: 'select',

  setTool: (tool) => {
    if (tool === get().tool) return;
    if (tool !== 'hand') set({ previousTool: tool });
    set({ tool });
  },

  restoreTool: () => set({ tool: get().previousTool }),
}));
