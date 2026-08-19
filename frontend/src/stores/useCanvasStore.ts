import { create } from 'zustand';
import { Point, type Canvas } from 'fabric';
import { clamp } from '../utils';

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.1;
const MAX_SCALE = 4;

interface CanvasState {
  canvas: Canvas | null;
  container: HTMLDivElement | null;
  viewport: Viewport;
  gridVisible: boolean;
  ready: boolean;
  register: (canvas: Canvas, container: HTMLDivElement) => void;
  unregister: () => void;
  setReady: (ready: boolean) => void;
  applyViewport: () => void;
  zoomTo: (scale: number, center?: { x: number; y: number }) => void;
  zoomBy: (factor: number, center?: { x: number; y: number }) => void;
  panBy: (dx: number, dy: number) => void;
  resetView: () => void;
  toggleGrid: () => void;
  setGrid: (visible: boolean) => void;
  /** Update canvas background when the app theme changes */
  applyTheme: (isDark: boolean) => void;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  screenToWorld: (x: number, y: number) => { x: number; y: number };
}

export const useCanvasStore = create<CanvasState>((set, get) => {
  const syncViewportFromCanvas = () => {
    const canvas = get().canvas;
    if (!canvas) return;
    const [a, , , , e, f] = canvas.viewportTransform;
    set({ viewport: { x: e, y: f, scale: a } });
  };

  return {
    canvas: null,
    container: null,
    viewport: { x: 0, y: 0, scale: 1 },
    gridVisible: true,
    ready: false,

    register: (canvas, container) => {
      canvas.on('mouse:wheel', () => syncViewportFromCanvas());
      set({ canvas, container, viewport: { x: 0, y: 0, scale: 1 } });
    },

    unregister: () => {
      const { canvas } = get();
      canvas?.off('mouse:wheel');
      set({ canvas: null, container: null, ready: false });
    },

    setReady: (ready) => set({ ready }),

    applyViewport: () => {
      const { canvas, viewport } = get();
      if (!canvas) return;
      canvas.viewportTransform = [viewport.scale, 0, 0, viewport.scale, viewport.x, viewport.y];
      canvas.requestRenderAll();
    },

    zoomTo: (scale, center) => {
      const { canvas, container } = get();
      const next = clamp(scale, MIN_SCALE, MAX_SCALE);
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const cx = center?.x ?? rect.width / 2;
      const cy = center?.y ?? rect.height / 2;
      canvas.zoomToPoint(new Point(cx, cy), next);
      syncViewportFromCanvas();
    },

    zoomBy: (factor, center) => {
      const { viewport } = get();
      get().zoomTo(viewport.scale * factor, center);
    },

    panBy: (dx, dy) => {
      const { canvas, viewport } = get();
      if (!canvas) return;
      const next = { ...viewport, x: viewport.x + dx, y: viewport.y + dy };
      set({ viewport: next });
      canvas.viewportTransform = [next.scale, 0, 0, next.scale, next.x, next.y];
      canvas.requestRenderAll();
    },

    resetView: () => {
      const { canvas, container } = get();
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.setViewportTransform([1, 0, 0, 1, rect.width / 2, rect.height / 2]);
      syncViewportFromCanvas();
    },

    toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
    setGrid: (gridVisible) => set({ gridVisible }),

    applyTheme: (isDark) => {
      const { canvas } = get();
      if (!canvas) return;
      // Update canvas background to match the CSS variable value
      canvas.backgroundColor = isDark ? '#1b1a17' : '#fdfdfc';
      canvas.requestRenderAll();
    },

    worldToScreen: (x, y) => {
      const { viewport } = get();
      return { x: x * viewport.scale + viewport.x, y: y * viewport.scale + viewport.y };
    },

    screenToWorld: (x, y) => {
      const { viewport } = get();
      return { x: (x - viewport.x) / viewport.scale, y: (y - viewport.y) / viewport.scale };
    },
  };
});
