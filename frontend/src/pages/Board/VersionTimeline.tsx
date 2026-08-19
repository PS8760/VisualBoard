import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '../../stores/useUIStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { fetchVersions, restoreVersion } from '../../api/version.api';
import { timeAgo } from '../../utils';
import { cn } from '../../utils';
import type { BoardVersion } from '../../types';

export default function VersionTimeline() {
  const open = useUIStore((s) => s.versionTimelineOpen);
  const setOpen = useUIStore((s) => s.setVersionTimeline);
  const board = useBoardStore((s) => s.board);
  const load = useBoardStore((s) => s.load);
  const [versions, setVersions] = useState<BoardVersion[]>([]);
  const [active, setActive] = useState<number>(0);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (open && board?.id) {
      fetchVersions(board.id).then((v) => {
        setVersions(v);
        setActive(v.length - 1); // Select most recent
      });
    }
  }, [open, board?.id]);

  const handleRestore = async () => {
    if (!versions[active] || !board?.id || restoring) return;
    
    setRestoring(true);
    const result = await restoreVersion(versions[active]!.id);
    
    if (result.ok) {
      toast.success(`Restored to ${versions[active]?.label ?? 'this version'}`);
      await load(board.id); // Reload board to show restored state
      setOpen(false);
    } else {
      toast.error('Restore failed', { description: result.message });
    }
    setRestoring(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 top-12 z-30 border-b border-line bg-paper shadow-md"
          role="dialog"
          aria-label="Version history"
        >
          <div className="mx-auto max-w-3xl px-5 py-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <HistoryIcon size={14} className="text-ink-3" />
                Version history
                <span className="font-mono text-[10px] font-normal text-ink-3">
                  {board?.title}
                </span>
              </p>
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
                aria-label="Close version history"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex items-start gap-2 overflow-x-auto pb-2">
              {versions.map((v, i) => {
                const isActive = active === i;
                const isLast = i === versions.length - 1;
                return (
                  <div key={v.id} className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => setActive(i)}
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      className={cn(
                        'group w-[150px] rounded-lg border p-2 text-left transition-all duration-150',
                        isActive
                          ? 'border-accent/50 bg-accent-softer shadow-sm'
                          : 'border-line hover:border-line-2 hover:bg-paper-2',
                      )}
                    >
                      <p className={cn('text-[11.5px] font-semibold', isActive ? 'text-accent' : 'text-ink')}>
                        {v.label}
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-ink-3">
                        {v.author} · {timeAgo(v.timestamp)}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-[9.5px] leading-snug text-ink-3">
                        {v.description}
                      </p>
                      <p className="mt-1 font-mono text-[8.5px] text-ink-3">
                        {v.elementCount} elements
                      </p>
                    </button>
                    {!isLast && <span className="h-px w-4 bg-line-2" aria-hidden="true" />}
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
              <p className="font-mono text-[9.5px] text-ink-3">
                autosaved every change · {versions.length} snapshots
              </p>
              <button
                disabled={active === versions.length - 1 || restoring}
                onClick={handleRestore}
                className="h-6 rounded-sm bg-ink px-2.5 text-[10.5px] font-medium text-paper transition-colors hover:bg-black disabled:pointer-events-none disabled:opacity-40"
              >
                {restoring ? 'Restoring...' : 'Restore'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}