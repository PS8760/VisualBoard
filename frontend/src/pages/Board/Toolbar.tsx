import {
  MousePointer2, Hand, PenLine, Square, Circle as CircleIcon, Minus,
  MoveUpRight, Type, StickyNote, Image as ImageIcon, FileText,
  MessageSquare, MoreHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../utils';
import { useToolStore } from '../../stores/useToolStore';
import type { Tool } from '../../types';

interface ToolDef {
  id: Tool;
  icon: LucideIcon;
  label: string;
  key?: string;
}

const TOOLS: ToolDef[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'hand', icon: Hand, label: 'Hand / Pan', key: 'H' },
  { id: 'pen', icon: PenLine, label: 'Freehand', key: 'P' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'circle', icon: CircleIcon, label: 'Circle', key: 'O' },
  { id: 'line', icon: Minus, label: 'Line', key: 'L' },
  { id: 'arrow', icon: MoveUpRight, label: 'Arrow', key: 'A' },
  { id: 'text', icon: Type, label: 'Text', key: 'T' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky note', key: 'S' },
  { id: 'image', icon: ImageIcon, label: 'Image' },
  { id: 'document', icon: FileText, label: 'Document', key: 'D' },
  { id: 'comment', icon: MessageSquare, label: 'Comment', key: 'C' },
];

function ToolButton({ def }: { def: ToolDef }) {
  const tool = useToolStore((s) => s.tool);
  const setTool = useToolStore((s) => s.setTool);
  const active = tool === def.id;

  return (
    <Tooltip
      label={def.label}
      shortcut={def.key ? [def.key] : undefined}
      side="right"
    >
      <button
        onClick={() => setTool(def.id)}
        aria-label={def.label}
        aria-pressed={active}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-sm transition-colors duration-100',
          active ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
        )}
      >
        <def.icon size={15} />
      </button>
    </Tooltip>
  );
}

export default function Toolbar() {
  return (
    <div className="flex w-[46px] shrink-0 flex-col items-center gap-0.5 border-r border-line bg-paper-2/50 py-2">
      {TOOLS.slice(0, 8).map((def) => (
        <ToolButton key={def.id} def={def} />
      ))}
      <div className="my-1.5 h-px w-6 bg-line" aria-hidden="true" />
      {TOOLS.slice(8).map((def) => (
        <ToolButton key={def.id} def={def} />
      ))}
      <div className="mt-auto flex flex-col items-center gap-0.5">
        <Tooltip label="More tools" side="right">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink-2"
            aria-label="More tools"
          >
            <MoreHorizontal size={15} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}