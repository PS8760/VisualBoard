import {
  Wand2, Undo2, Redo2, ZoomIn, ZoomOut, Grid3X3, Plus, CircleDot, Loader2,
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
import { arrangeBoard } from '../../api/board.api';
import type { ArrangeTarget } from '../../services/arrange';
import type { FabricObject } from 'fabric';

/** Minimum visible duration of the "analyzing" phase. */
const ANALYZE_MIN_MS = 2800;
/** Backend budget before falling back to the local layout. */
const ANALYZE_TIMEOUT_MS = 4000;

export default function StatusBar() {
  const board = useBoardStore((s) => s.board);
  const canUndo = useBoardStore((s) => s.history.length > 0);
  const canRedo = useBoardStore((s) => s.future.length > 0);
  const tool = useToolStore((s) => s.tool);
  const viewport = useCanvasStore((s) => s.viewport);
  const gridVisible = useCanvasStore((s) => s.gridVisible);
  const arrangeAnalyzing = useUIStore((s) => s.arrangeAnalyzing);

  const arrange = async () => {
    const { updateElement, commitHistory } = useBoardStore.getState();
    const canvas = useCanvasStore.getState().canvas;
    const ui = useUIStore.getState();
    if (!canvas || !board?.elements.length || !board.id || ui.arrangeAnalyzing) return;

    ui.setArrangeAnalyzing(true);
    ui.setArrangeComplete(false);

    // Hold the analyzing phase for a few seconds while the backend runs,
    // bounded by a timeout — layout always resolves via the local fallback.
    const [result] = await Promise.all([
      Promise.race([
        arrangeBoard(board.id),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), ANALYZE_TIMEOUT_MS)),
      ]),
      new Promise((resolve) => setTimeout(resolve, ANALYZE_MIN_MS)),
    ]);

    let targets: ArrangeTarget[];
    if (result?.ok && result.positions) {
      targets = Object.entries(result.positions).map(([id, pos]) => ({
        id,
        x: pos.x,
        y: pos.y,
      }));
    } else {
      targets = useBoardStore.getState().arrange();
      if (result && !result.ok) {
        toast.info('Arranged locally', {
          description: result.message ?? 'The server could not arrange this board.',
        });
      } else if (!result) {
        toast.info('Arranged locally', {
          description: 'The server took too long — used the local layout.',
        });
      }
    }

    ui.setArrangeAnalyzing(false);
    if (!targets.length) return;

    const objects = targets
      .map((t) => {
        const obj = canvas.getObjects().find((o) => elementId(o) === t.id);
        return obj ? { object: obj, ...t } : null;
      })
      .filter(Boolean) as Array<{ object: FabricObject; id: string; x?: number; y?: number; points?: number[] }>;

    animateArrangement(
      objects,
      () => {
        useUIStore.getState().setArrangeComplete(true);
        targets.forEach((t) => {
          const patch: Partial<{ x: number; y: number; points: number[] }> = {};
          if (t.x !== undefined) patch.x = t.x;
          if (t.y !== undefined) patch.y = t.y;
          if (t.points) patch.points = t.points;
          if (Object.keys(patch).length) updateElement(t.id, patch);
        });
        commitHistory();
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
            disabled={!board || !board.elements.length || arrangeAnalyzing}
            className={cn(
              'flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[11.5px] font-medium transition-colors',
              !board || !board.elements.length || arrangeAnalyzing
                ? 'bg-paper-2 text-ink-3 cursor-not-allowed opacity-60'
                : 'bg-ink text-paper hover:bg-black',
            )}
            aria-label="Arrange elements"
          >
            {arrangeAnalyzing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Wand2 size={12} />
            )}
            {arrangeAnalyzing ? 'Analyzing…' : 'Auto Arrange'}
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