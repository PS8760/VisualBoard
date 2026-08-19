import { Square } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useToolStore } from '../../stores/useToolStore';

export default function EmptyBoard() {
  const setTool = useToolStore((s) => s.setTool);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-board">
      <div className="pointer-events-auto flex max-w-sm flex-col items-center rounded-xl border border-dashed border-line-2 bg-paper/70 px-8 py-10 text-center backdrop-blur-[2px]">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-line-2 bg-paper-2 text-ink-2">
          <Square size={17} />
        </span>
        <h2 className="text-[15px] font-semibold text-ink">Your canvas is empty</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">
          Start with a shape, a sketch, or an idea. Use the toolbar on the left,
          or hit <kbd className="rounded-sm border border-line-2 bg-paper px-1.5 py-0.5 font-mono text-[10px] text-ink-2">R</kbd> for a rectangle.
        </p>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setTool('rect')}>
            Add a shape
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setTool('sticky')}>
            Add a note
          </Button>
        </div>
        <p className="mt-5 font-mono text-[10px] text-ink-3">
          drag &amp; drop files anywhere to attach them
        </p>
      </div>
    </div>
  );
}