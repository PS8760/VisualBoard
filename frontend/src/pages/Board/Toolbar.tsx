import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MousePointer2,
  Hand,
  PenLine,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Type,
  StickyNote,
  Image,
  FileText,
  MessageCircle,
  Zap,
  ChevronUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../utils';
import { useToolStore, SHAPE_TOOLS, type ShapeTool } from '../../stores/useToolStore';
import { useBoardStore } from '../../stores/useBoardStore';
import type { Tool } from '../../types';

interface ToolDef {
  id: Tool;
  icon: LucideIcon;
  label: string;
  key: string;
}

const TOOL: Record<Exclude<Tool, never>, ToolDef> = {
  select: { id: 'select', icon: MousePointer2, label: 'Select', key: 'V' },
  hand: { id: 'hand', icon: Hand, label: 'Hand', key: 'H' },
  pen: { id: 'pen', icon: PenLine, label: 'Draw', key: 'P' },
  rect: { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' },
  circle: { id: 'circle', icon: Circle, label: 'Circle', key: 'O' },
  line: { id: 'line', icon: Minus, label: 'Line', key: 'L' },
  arrow: { id: 'arrow', icon: ArrowRight, label: 'Connector', key: 'A' },
  text: { id: 'text', icon: Type, label: 'Text', key: 'T' },
  sticky: { id: 'sticky', icon: StickyNote, label: 'Sticky note', key: 'S' },
  image: { id: 'image', icon: Image, label: 'Image', key: 'I' },
  document: { id: 'document', icon: FileText, label: 'Document', key: 'D' },
  comment: { id: 'comment', icon: MessageCircle, label: 'Comment', key: 'C' },
  laser: { id: 'laser', icon: Zap, label: 'Laser pointer', key: 'K' },
};

const GROUPS_EDIT: Array<Array<Tool | 'shapes'>> = [
  ['select', 'hand'],
  ['pen', 'shapes', 'text', 'sticky'],
  ['image', 'document'],
  ['comment', 'laser'],
];
const GROUPS_VIEW: Array<Array<Tool | 'shapes'>> = [['select', 'hand'], ['comment', 'laser']];

/** Pill behind the active tool, shared across buttons for a sliding animation. */
function ActivePill() {
  return (
    <motion.span
      layoutId="dock-active"
      className="absolute inset-0 -z-0 rounded-[0.65rem] bg-ink shadow-sm"
      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
    />
  );
}

function DockButton({ def, active, onClick, tourId }: { def: ToolDef; active: boolean; onClick: () => void; tourId?: string }) {
  return (
    <Tooltip label={def.label} shortcut={[def.key]} side="top">
      <button
        onClick={onClick}
        aria-label={def.label === 'Draw' ? 'Pen' : def.label}
        aria-pressed={active}
        data-tour={tourId ?? `tool-${def.id}`}
        className={cn('island-btn relative isolate h-10 w-10', active && 'bg-ink text-paper hover:bg-ink hover:text-paper')}
      >
        {active && <ActivePill />}
        <def.icon size={17} strokeWidth={active ? 2.1 : 1.8} className="relative z-10" />
      </button>
    </Tooltip>
  );
}

export default function Toolbar() {
  const tool = useToolStore((s) => s.tool);
  const setTool = useToolStore((s) => s.setTool);
  const shapeTool = useToolStore((s) => s.shapeTool);
  const canEdit = useBoardStore((s) => s.canEdit || s.isDemo);
  const [shapesOpen, setShapesOpen] = useState(false);
  const shapesRef = useRef<HTMLDivElement>(null);

  const shapeActive = (SHAPE_TOOLS as Tool[]).includes(tool);

  // Close the flyout on outside click / Escape / tool change via keyboard.
  useEffect(() => {
    if (!shapesOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!shapesRef.current?.contains(e.target as Node)) setShapesOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShapesOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [shapesOpen]);

  const groups = canEdit ? GROUPS_EDIT : GROUPS_VIEW;

  return (
    <div
      data-tour="toolbar"
      role="toolbar"
      aria-label="Tools"
      className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5"
    >
      {groups.map((group, gi) => (
        <div key={gi} className="flex items-center gap-0.5">
          {gi > 0 && <span className="mx-1 h-6 w-px bg-line-2" aria-hidden="true" />}
          {group.map((id) => {
            if (id !== 'shapes') {
              const def = TOOL[id];
              return <DockButton key={id} def={def} active={tool === id} onClick={() => setTool(id)} />;
            }
            const current = TOOL[shapeTool];
            return (
              <div key="shapes" ref={shapesRef} className="relative flex items-center">
                <Tooltip label={`Shapes · ${current.label}`} shortcut={[current.key]} side="top">
                  <button
                    onClick={() => {
                      if (!shapeActive) setTool(shapeTool);
                      setShapesOpen((o) => !o);
                    }}
                    aria-label="Shapes"
                    aria-haspopup="menu"
                    aria-expanded={shapesOpen}
                    aria-pressed={shapeActive}
                    data-tour="tool-shapes"
                    className={cn('island-btn relative isolate h-10 w-10', shapeActive && 'bg-ink text-paper hover:bg-ink hover:text-paper')}
                  >
                    {shapeActive && <ActivePill />}
                    <current.icon size={17} strokeWidth={shapeActive ? 2.1 : 1.8} className="relative z-10" />
                    <ChevronUp
                      size={9}
                      strokeWidth={2.4}
                      className={cn('absolute right-0.5 top-0.5 z-10 opacity-60 transition-transform', shapesOpen && 'rotate-180')}
                    />
                  </button>
                </Tooltip>
                <AnimatePresence>
                  {shapesOpen && (
                    <motion.div
                      role="menu"
                      aria-label="Shapes"
                      initial={{ opacity: 0, y: 6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.96 }}
                      transition={{ duration: 0.14 }}
                      className="glass absolute bottom-full left-1/2 mb-3 flex -translate-x-1/2 gap-0.5 rounded-xl p-1"
                    >
                      {SHAPE_TOOLS.map((id: ShapeTool) => {
                        const def = TOOL[id];
                        const active = tool === id;
                        return (
                          <Tooltip key={id} label={def.label} shortcut={[def.key]} side="top">
                            <button
                              role="menuitemradio"
                              aria-checked={active}
                              aria-label={def.label}
                              data-tour={`tool-${id}`}
                              onClick={() => {
                                setTool(id);
                                setShapesOpen(false);
                              }}
                              className={cn('island-btn h-9 w-9', active && 'bg-ink text-paper hover:bg-ink hover:text-paper')}
                            >
                              <def.icon size={16} />
                            </button>
                          </Tooltip>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
