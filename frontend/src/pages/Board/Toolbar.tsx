import { 
  MousePointer2, 
  Hand, 
  Pen, 
  Square, 
  Circle, 
  Minus, 
  ArrowRight, 
  Type, 
  StickyNote, 
  Image, 
  FileText, 
  MessageCircle 
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
  { id: 'pen', icon: Pen, label: 'Pen', key: 'P' },
  { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  { id: 'circle', icon: Circle, label: 'Circle', key: 'O' },
  { id: 'line', icon: Minus, label: 'Line', key: 'L' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow', key: 'A' },
  { id: 'text', icon: Type, label: 'Text', key: 'T' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky Note', key: 'S' },
  { id: 'image', icon: Image, label: 'Image', key: 'I' },
  { id: 'document', icon: FileText, label: 'Document', key: 'D' },
  { id: 'comment', icon: MessageCircle, label: 'Comment', key: 'C' },
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
      {TOOLS.map((def) => (
        <ToolButton key={def.id} def={def} />
      ))}
    </div>
  );
}