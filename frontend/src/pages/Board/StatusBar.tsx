import {
  Wand2, Undo2, Redo2, ZoomIn, ZoomOut, Grid3X3, Plus, CircleDot,
} from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../utils';
import { useBoardStore } from '../../stores/useBoardStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useToolStore } from '../../stores/useToolStore';
import { useUIStore } from '../../stores/useUIStore';
import { TOOL_LABEL } from '../../utils/shortcuts';
import { elementId } from '../../services/fabric.elements';
import { animateArrangement, completionPulse } from '../../animations/boardAnimations';
import type { FabricObject } from 'fabric';

export default function StatusBar() {
  const board = useBoardStore((s) => s.board);
  const canUndo = useBoardStore((s) => s.history.length > 0);
  const canRedo = useBoardStore((s) => s.future.length > 0);
  const tool = useToolStore((s) => s.tool);
  const viewport = useCanvasStore((s) => s.viewport);
  const gridVisible = useCanvasStore((s) => s.gridVisible);

  const arrange = () => {
    const { arrange, updateElement } = useBoardStore.getState();
    const canvas = useCanvasStore.getState().canvas;
    if (!canvas || !board?.elements.length) return;

    const targets = arrange();
    const objects = targets
      .map((t) => {
        const obj = canvas
          .getObjects()
          .find((o) => elementId(o) === t.id);
        return obj ? { object: obj, ...t } : null;
      })
      .filter(Boolean) as Array<{ object: FabricObject; id: string; x?: number; y?: number; points?: number[] }>;

    useUIStore.getState().setArrangeComplete(false);
    animateArrangement(
      objects,
      () => {
        useUIStore.getState().setArrangeComplete(true);
        targets.forEach((t) => {
          if (t.x !== undefined && t.y !== undefined) {
            updateElement(t.id, { x: t.x, y: t.y });
          }
        });
        useBoardStore.getState().commitHistory();
        completionPulse(document.getElementById('arrange-badge'));
      },
      (p) => {
        if (p === 1) useUIStore.getState().setArrangeComplete(true);
      },
    );
    toast.success('Board arranged', { description: 'Elements moved into a structured layout.' });
  };

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between border-t border-line bg-paper px-3">
      <div className="flex items-center gap-1">
        <Tooltip label="Arrange elements" shortcut={['⇧', 'A']}>
          <button
            id="arrange-button"
            onClick={arrange}
            disabled={!board || !board.elements.length}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[11.5px] font-medium transition-colors',
              !board || !board.elements.length
                ? 'bg-paper-2 text-ink-3 cursor-not-allowed opacity-60'
                : 'bg-ink text-paper hover:bg-black',
            )}
            aria-label="Arrange elements"
          >
            <Wand2 size={12} />
            Auto Arrange
          </button>
        </Tooltip>

        <span className="mx-1.5 h-4 w-px bg-line" aria-hidden="true" />

        <Tooltip label="Undo" shortcut={['⌘', 'Z']}>
          <button
            onClick={() => useBoardStore.getState().undo()}
            disabled={!canUndo}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Undo"
          >
            <Undo2 size={13} />
          </button>
        </Tooltip>
        <Tooltip label="Redo" shortcut={['⌘', '⇧', 'Z']}>
          <button
            onClick={() => useBoardStore.getState().redo()}
            disabled={!canRedo}
            className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label="Redo"
          >
            <Redo2 size={13} />
          </button>
        </Tooltip>
      </div>

      <div className="hidden items-center gap-3 font-mono text-[10.5px] text-ink-3 md:flex">
        <span className="inline-flex items-center gap-1.5">
          <CircleDot size={11} />
          {TOOL_LABEL[tool]}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Grid3X3 size={11} />
          grid {gridVisible ? 'on' : 'off'}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Plus size={11} />
          <ZoomOut size={11} className="cursor-pointer" onClick={() => useCanvasStore.getState().zoomBy(0.9)} />
          <span className="tabular-nums text-ink-2">{Math.round(viewport.scale * 100)}%</span>
          <ZoomIn size={11} className="cursor-pointer" onClick={() => useCanvasStore.getState().zoomBy(1.1)} />
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Tooltip label="Toggle grid" shortcut={['G']}>
          <button
            onClick={() => useCanvasStore.getState().toggleGrid()}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-sm transition-colors',
              gridVisible ? 'bg-paper-2 text-ink' : 'text-ink-3 hover:bg-paper-2 hover:text-ink-2',
            )}
            aria-label="Toggle grid"
            aria-pressed={gridVisible}
          >
            <Grid3X3 size={13} />
          </button>
        </Tooltip>
      </div>
    </footer>
  );
}