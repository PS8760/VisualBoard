import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Maximize2, Map as MapIcon, HelpCircle, Grid3X3, Eye } from 'lucide-react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useUIStore } from '../../stores/useUIStore';
import { Tooltip } from '../../components/ui/Tooltip';
import { elementBox, sortByZ, unionBox, type Box } from '../../services/geometry';
import { fitToContent, zoomAroundCenter } from '../../services/viewport';
import { cn } from '../../utils';

const MAP_W = 216;
const MAP_H = 136;


/**
 * Minimap: whole-board overview with the visible area as a draggable lens.
 * Rendered on a 2D canvas (cheap at any element count); click or drag to
 * navigate.
 */
function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  const elements = useBoardStore((s) => s.board?.elements);
  const viewport = useCanvasStore((s) => s.viewport);
  const container = useCanvasStore((s) => s.container);
  const mapRef = useRef<{ world: Box; k: number; ox: number; oy: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = MAP_W * dpr;
    canvas.height = MAP_H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MAP_W, MAP_H);

    const view: Box = {
      x: -viewport.x / viewport.scale,
      y: -viewport.y / viewport.scale,
      w: container.clientWidth / viewport.scale,
      h: container.clientHeight / viewport.scale,
    };
    const boxes = (elements ? sortByZ(elements) : []).map((el) => ({ el, box: elementBox(el) }));
    const world = unionBox([view, ...boxes.map((b) => b.box)])!;
    const pad = 0.08;
    const k = Math.min(MAP_W / (world.w * (1 + pad * 2)), MAP_H / (world.h * (1 + pad * 2)));
    const ox = (MAP_W - world.w * k) / 2 - world.x * k;
    const oy = (MAP_H - world.h * k) / 2 - world.y * k;
    mapRef.current = { world, k, ox, oy };

    const styles = getComputedStyle(document.documentElement);
    const ink = styles.getPropertyValue('--color-ink-3').trim() || '#78766e';
    const accent = styles.getPropertyValue('--color-accent').trim() || '#d9480f';

    for (const { el, box } of boxes) {
      const x = box.x * k + ox;
      const y = box.y * k + oy;
      const w = Math.max(1.5, box.w * k);
      const h = Math.max(1.5, box.h * k);
      if (el.kind === 'line' || el.kind === 'arrow') {
        const [x1, y1, x2, y2] = (el.points ?? [box.x, box.y, box.x + box.w, box.y + box.h]) as number[];
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x1! * k + ox, y1! * k + oy);
        ctx.lineTo(x2! * k + ox, y2! * k + oy);
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : ink;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, w, h);
    }

    // Viewport lens
    ctx.fillStyle = `${accent}1f`;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    const lx = view.x * k + ox;
    const ly = view.y * k + oy;
    ctx.fillRect(lx, ly, view.w * k, view.h * k);
    ctx.strokeRect(lx, ly, view.w * k, view.h * k);
  }, [elements, viewport, container]);

  const navigate = (e: React.PointerEvent, animate: boolean) => {
    const map = mapRef.current;
    const { container: c, viewport: v, animateTo, canvas } = useCanvasStore.getState();
    if (!map || !c || !canvas) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const wx = (e.clientX - rect.left - map.ox) / map.k;
    const wy = (e.clientY - rect.top - map.oy) / map.k;
    const target = { scale: v.scale, x: c.clientWidth / 2 - wx * v.scale, y: c.clientHeight / 2 - wy * v.scale };
    if (animate) animateTo(target, 220);
    else {
      canvas.setViewportTransform([target.scale, 0, 0, target.scale, target.x, target.y]);
      canvas.requestRenderAll();
      useCanvasStore.getState().syncViewport();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.16 }}
      className="glass pointer-events-auto overflow-hidden rounded-2xl p-1.5"
    >
      <canvas
        ref={ref}
        width={MAP_W}
        height={MAP_H}
        style={{ width: MAP_W, height: MAP_H }}
        className="block cursor-pointer rounded-xl bg-paper-2/70"
        aria-label="Minimap — click or drag to navigate"
        role="img"
        onPointerDown={(e) => {
          dragging.current = true;
          (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
          navigate(e, true);
        }}
        onPointerMove={(e) => dragging.current && navigate(e, false)}
        onPointerUp={() => {
          dragging.current = false;
        }}
      />
    </motion.div>
  );
}

/** Bottom-right island: zoom, fit, minimap, grid, zen mode and help. */
export default function NavigationDock() {
  const scale = useCanvasStore((s) => s.viewport.scale);
  const gridVisible = useCanvasStore((s) => s.gridVisible);
  const minimapVisible = useUIStore((s) => s.minimapVisible);
  const [menu, setMenu] = useState(false);

  return (
    <div className="flex flex-col items-end gap-2">
      <AnimatePresence>{minimapVisible && <Minimap />}</AnimatePresence>
      <div className="glass pointer-events-auto relative flex items-center gap-0.5 rounded-2xl p-1.5" role="toolbar" aria-label="Navigation" data-tour="zoom">
        <Tooltip label="Zoom out" shortcut={['⌘', '-']} side="top">
          <button className="island-btn" onClick={() => zoomAroundCenter(scale / 1.25)} aria-label="Zoom out">
            <Minus size={15} />
          </button>
        </Tooltip>
        <button
          className="island-btn w-14 font-mono text-[11.5px] tabular-nums text-ink"
          onClick={() => setMenu((m) => !m)}
          aria-label={`Zoom ${Math.round(scale * 100)}% — zoom presets`}
          aria-expanded={menu}
        >
          {Math.round(scale * 100)}%
        </button>
        <Tooltip label="Zoom in" shortcut={['⌘', '+']} side="top">
          <button className="island-btn" onClick={() => zoomAroundCenter(scale * 1.25)} aria-label="Zoom in">
            <Plus size={15} />
          </button>
        </Tooltip>
        <span className="mx-1 h-6 w-px bg-line-2" aria-hidden="true" />
        <Tooltip label="Fit to content" shortcut={['⇧', '1']} side="top">
          <button className="island-btn" onClick={fitToContent} aria-label="Fit to content">
            <Maximize2 size={15} />
          </button>
        </Tooltip>
        <Tooltip label={minimapVisible ? 'Hide minimap' : 'Show minimap'} shortcut={['M']} side="top">
          <button
            className={cn('island-btn', minimapVisible && 'bg-paper-3 text-ink')}
            onClick={() => useUIStore.getState().setMinimapVisible(!minimapVisible)}
            aria-label="Toggle minimap"
            aria-pressed={minimapVisible}
          >
            <MapIcon size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Toggle grid" shortcut={['G']} side="top">
          <button
            className={cn('island-btn', gridVisible && 'bg-paper-3 text-ink')}
            onClick={() => useCanvasStore.getState().toggleGrid()}
            aria-label="Toggle grid"
          >
            <Grid3X3 size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Zen mode" shortcut={['⌘', '.']} side="top">
          <button className="island-btn" onClick={() => useUIStore.getState().setZen(true)} aria-label="Zen mode">
            <Eye size={15} />
          </button>
        </Tooltip>
        <Tooltip label="Help & shortcuts" shortcut={['?']} side="top">
          <button className="island-btn" onClick={() => window.dispatchEvent(new Event('vb:open-help'))} aria-label="Show help">
            <HelpCircle size={15} />
          </button>
        </Tooltip>

        <AnimatePresence>
          {menu && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.12 }}
              className="glass absolute bottom-full left-6 mb-2 w-40 rounded-xl p-1"
              role="menu"
              onMouseLeave={() => setMenu(false)}
            >
              {[
                ['Zoom to 50%', () => zoomAroundCenter(0.5), ''],
                ['Zoom to 100%', () => zoomAroundCenter(1), '1'],
                ['Zoom to 200%', () => zoomAroundCenter(2), ''],
                ['Fit to content', fitToContent, '⇧1'],
              ].map(([label, fn, key]) => (
                <button
                  key={label as string}
                  role="menuitem"
                  onClick={() => {
                    (fn as () => void)();
                    setMenu(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[12px] text-ink-2 hover:bg-paper-3 hover:text-ink"
                >
                  {label as string}
                  <span className="font-mono text-[10px] text-ink-3">{key as string}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
