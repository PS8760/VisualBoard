import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Wand2, Type, Square, Paperclip, MessageSquare, History,
  Share2, Grid3X3, Settings, Command, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../utils';
import { useUIStore } from '../../stores/useUIStore';
import { useToolStore } from '../../stores/useToolStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { useBoardStore } from '../../stores/useBoardStore';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Plus;
  run: () => void;
}

export default function CommandPalette() {
  const open = useUIStore((s) => s.commandPaletteOpen);
  const setOpen = useUIStore((s) => s.setCommandPalette);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        setQuery('');
        setIndex(0);
        inputRef.current?.focus();
      }, 20);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const commands = useMemo<CommandItem[]>(() => {
    const close = () => setOpen(false);
    const selectedIds = useBoardStore.getState().selectedIds;
    const hasSelection = selectedIds.length > 0;

    return [
      {
        id: 'new-board', label: 'Create board', icon: Plus,
        run: () => {
          useBoardStore.getState().createDemoBoard();
          toast.success('New board created');
          close();
          navigate('/board/new');
        },
      },
      {
        id: 'arrange', label: 'Arrange elements', icon: Wand2,
        run: () => {
          close();
          document.getElementById('arrange-trigger')?.click();
        },
      },
      {
        id: 'copy', label: hasSelection ? `Copy ${selectedIds.length} element${selectedIds.length > 1 ? 's' : ''}` : 'Copy', icon: Plus, hint: '⌘C',
        run: () => {
          if (hasSelection) {
            useBoardStore.getState().copyElements(selectedIds);
            toast.success('Copied to clipboard');
          }
          close();
        },
      },
      {
        id: 'paste', label: 'Paste', icon: Plus, hint: '⌘V',
        run: () => {
          useBoardStore.getState().pasteElements();
          close();
        },
      },
      {
        id: 'duplicate', label: hasSelection ? `Duplicate ${selectedIds.length} element${selectedIds.length > 1 ? 's' : ''}` : 'Duplicate', icon: Plus, hint: '⌘D',
        run: () => {
          if (hasSelection) {
            useBoardStore.getState().duplicateElements(selectedIds);
            toast.success('Duplicated');
          }
          close();
        },
      },
      {
        id: 'delete', label: hasSelection ? `Delete ${selectedIds.length} element${selectedIds.length > 1 ? 's' : ''}` : 'Delete', icon: Plus, hint: 'Del',
        run: () => {
          if (hasSelection) {
            useBoardStore.getState().removeElements(selectedIds);
            toast.success('Deleted');
          }
          close();
        },
      },
      {
        id: 'add-text', label: 'Add text', icon: Type, hint: 'T',
        run: () => { useToolStore.getState().setTool('text'); close(); },
      },
      {
        id: 'add-shape', label: 'Add shape', icon: Square, hint: 'R',
        run: () => { useToolStore.getState().setTool('rect'); close(); },
      },
      {
        id: 'attach-doc', label: 'Attach document', icon: Paperclip,
        run: () => {
          close();
          toast.info('Drag & drop a file onto the canvas to attach it.');
        },
      },
      {
        id: 'add-comment', label: 'Add comment', icon: MessageSquare, hint: 'C',
        run: () => { useToolStore.getState().setTool('comment'); close(); },
      },
      {
        id: 'versions', label: 'View versions', icon: History,
        run: () => { useUIStore.getState().setVersionTimeline(true); close(); },
      },
      {
        id: 'share', label: 'Share board', icon: Share2,
        run: () => {
          navigator.clipboard?.writeText(window.location.href).catch(() => { });
          toast.success('Share link copied');
          close();
        },
      },
      {
        id: 'grid', label: 'Toggle grid', icon: Grid3X3, hint: 'G',
        run: () => { useCanvasStore.getState().toggleGrid(); close(); },
      },
      {
        id: 'settings', label: 'Board settings', icon: Settings,
        run: () => { useUIStore.getState().setRightPanelTab('info'); close(); },
      },
    ];
  }, [navigate, setOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  const execute = (item: CommandItem) => item.run();

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[index];
      if (item) execute(item);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[80] flex items-start justify-center bg-ink/25 pt-[16vh] backdrop-blur-[2px]"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md overflow-hidden rounded-lg border border-line-2 bg-paper shadow-lg"
          >
            <div className="flex items-center gap-2 border-b border-line px-3.5">
              <Search size={14} className="shrink-0 text-ink-3" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setIndex(0);
                }}
                onKeyDown={onKeyDown}
                placeholder="Type a command…"
                className="h-11 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-3 focus:outline-none"
                aria-label="Search commands"
              />
              <kbd className="rounded-[4px] border border-line-2 bg-paper-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-3">ESC</kbd>
            </div>

            <div className="max-h-[300px] overflow-y-auto p-1.5">
              {filtered.length === 0 && (
                <p className="px-3 py-6 text-center text-[12.5px] text-ink-3">
                  No command matches “{query}”
                </p>
              )}
              {filtered.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => execute(item)}
                  onMouseEnter={() => setIndex(i)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors duration-75',
                    i === index ? 'bg-paper-2 text-ink' : 'text-ink-2',
                  )}
                >
                  <item.icon size={14} className={i === index ? 'text-accent' : 'text-ink-3'} />
                  <span className="flex-1 text-[13px] font-medium">{item.label}</span>
                  {i === index && <Command size={11} className="text-ink-3" />}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-line px-3.5 py-2 font-mono text-[9.5px] text-ink-3">
              <span>↑↓ navigate</span>
              <span>↵ run</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}