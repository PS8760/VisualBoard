import { Wand2, Undo2, Redo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip } from '../../components/ui/Tooltip';
import { useBoardStore } from '../../stores/useBoardStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useUIStore } from '../../stores/useUIStore';
import { elementId } from '../../services/fabric.elements';
import { completionPulse } from '../../animations/boardAnimations';
import { computeAutoLayout } from '../../services/autoLayout';
import { ConnectorShape } from '../../services/fabric.elements';
import { connectorPatch, readConnector } from '../../services/connectors/model';
import { sceneFrom } from '../../services/connectors/route';
import type { FabricObject } from 'fabric';


export default function StatusBar() {
  const board = useBoardStore((s) => s.board);
  const canUndo = useBoardStore((s) => s.history.length > 0);
  const canRedo = useBoardStore((s) => s.future.length > 0);
  const arrangeAnalyzing = useUIStore((s) => s.arrangeAnalyzing);

  const arrange = () => {
    const ui = useUIStore.getState();
    const { canvas } = useCanvasStore.getState();
    const state = useBoardStore.getState();
    if (!canvas || !state.board?.elements.length || ui.arrangeAnalyzing) return;
    if (!state.canEdit && !state.isDemo) {
      toast.info('This board is view-only for you', { id: 'vb-readonly' });
      return;
    }

    // Arrange just the selection when several items are selected.
    const scope = state.selectedIds.length >= 2 ? new Set(state.selectedIds) : undefined;
    const elements = state.board.elements;
    const layout = computeAutoLayout(elements, scope);
    const moves = [...layout.positions].filter(([id, p]) => {
      const el = elements.find((e) => e.id === id);
      return el && (Math.abs(el.x - p.x) > 0.5 || Math.abs(el.y - p.y) > 0.5);
    });
    if (!moves.length && !layout.connectors.size) {
      toast.info('Already tidy', { description: 'Nothing needed to move.' });
      return;
    }

    ui.setArrangeAnalyzing(true);
    ui.setArrangeComplete(false);
    canvas.discardActiveObject();

    const objectOf = (id: string) => canvas.getObjects().find((o) => elementId(o) === id);
    const tracks = moves
      .map(([id, to]) => {
        const obj = objectOf(id);
        return obj ? { id, obj, from: { x: obj.left ?? 0, y: obj.top ?? 0 }, to } : null;
      })
      .filter(Boolean) as Array<{ id: string; obj: FabricObject; from: { x: number; y: number }; to: { x: number; y: number } }>;
    const lines = [...layout.connectors].map(([id, c]) => ({ id, c, obj: objectOf(id) }));
    const base = new Map(elements.map((el) => [el.id, el] as const));

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : 650;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
    const start = performance.now();

    const frame = (now: number) => {
      const k = duration ? ease(Math.min(1, (now - start) / duration)) : 1;
      const live = new Map(base);
      for (const t of tracks) {
        const x = t.from.x + (t.to.x - t.from.x) * k;
        const y = t.from.y + (t.to.y - t.from.y) * k;
        t.obj.set({ left: x, top: y });
        t.obj.setCoords();
        live.set(t.id, { ...base.get(t.id)!, x, y });
      }
      // Connectors follow the boxes every frame.
      const scene = sceneFrom([...live.values()]);
      for (const { id, c, obj } of lines) {
        if (!(obj instanceof ConnectorShape)) continue;
        obj.model = readConnector({ ...base.get(id)!, startBinding: c.startBinding, endBinding: c.endBinding, routing: c.routing, bend: c.bend, points: c.points, pointsAbsolute: true });
        obj.recompute(scene, { keepControls: true });
      }
      canvas.requestRenderAll();
      if (k < 1) {
        requestAnimationFrame(frame);
        return;
      }

      // Persist as ONE undo step.
      const { updateElement, commitHistory } = useBoardStore.getState();
      commitHistory();
      for (const t of tracks) updateElement(t.id, { x: t.to.x, y: t.to.y });
      for (const { id, c } of lines) {
        const model = readConnector({ ...base.get(id)!, startBinding: c.startBinding, endBinding: c.endBinding, routing: c.routing, bend: c.bend, points: c.points, pointsAbsolute: true });
        updateElement(id, connectorPatch(model));
      }
      commitHistory();

      const ui2 = useUIStore.getState();
      ui2.setArrangeAnalyzing(false);
      ui2.setArrangeComplete(true);
      completionPulse(document.getElementById('arrange-badge'));
      setTimeout(() => useUIStore.getState().setArrangeComplete(false), 2600);
      const what = layout.flowNodes
        ? `Laid out ${layout.flowNodes} connected item${layout.flowNodes === 1 ? '' : 's'} ${layout.direction === 'LR' ? 'left → right' : 'top → bottom'} by flow.`
        : 'Spaced items into a tidy layout.';
      toast.success(scope ? 'Selection arranged' : 'Board arranged', {
        description: `${what} Notes moved beside the diagram.`,
        action: { label: 'Undo', onClick: () => useBoardStore.getState().undo() },
      });
    };
    requestAnimationFrame(frame);
  };

  return (
    <div className="glass pointer-events-auto flex items-center gap-0.5 rounded-2xl p-1.5" role="toolbar" aria-label="History and layout">
      <Tooltip label="Undo" shortcut={['⌘', 'Z']} side="top">
        <button
          onClick={() => useBoardStore.getState().undo()}
          disabled={!canUndo}
          data-tour="undo"
          className="island-btn"
          aria-label="Undo"
        >
          <Undo2 size={16} />
        </button>
      </Tooltip>
      <Tooltip label="Redo" shortcut={['⌘', '⇧', 'Z']} side="top">
        <button
          onClick={() => useBoardStore.getState().redo()}
          disabled={!canRedo}
          data-tour="redo"
          className="island-btn"
          aria-label="Redo"
        >
          <Redo2 size={16} />
        </button>
      </Tooltip>
      <span className="mx-1 h-6 w-px bg-line-2" aria-hidden="true" />
      <Tooltip label="Auto-arrange by flow (selection or whole board)" shortcut={['⇧', 'A']} side="top">
        <button
          id="arrange-button"
          onClick={arrange}
          disabled={!board || !board.elements.length || arrangeAnalyzing}
          data-tour="arrange"
          className="island-btn gap-1.5 px-3 text-[12px] font-medium"
          aria-label="Arrange elements"
        >
          {arrangeAnalyzing ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
          <span className="hidden sm:inline">{arrangeAnalyzing ? 'Arranging…' : 'Arrange'}</span>
        </button>
      </Tooltip>
    </div>
  );
}
