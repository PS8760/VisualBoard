import { create } from 'zustand';
import type { Tool } from '../types';

interface ToolState {
  tool: Tool;
  previousTool: Tool;
  penWidth: number;
  penColor: string;
  setTool: (tool: Tool) => void;
  setPenWidth: (width: number) => void;
  setPenColor: (color: string) => void;
  /** Returns to previous non-hand tool after temporary pan */
  restoreTool: () => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  tool: 'select',
  previousTool: 'select',
  penWidth: 2,
  penColor: '#1b1a17',

  setTool: (tool) => {
    if (tool === get().tool) return;
    if (tool !== 'hand') set({ previousTool: tool });
    set({ tool });
  },

  setPenWidth: (penWidth) => set({ penWidth }),
  setPenColor: (penColor) => set({ penColor }),

  restoreTool: () => set({ tool: get().previousTool }),
}));
