import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, History as HistoryIcon, Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useUIStore } from '../../stores/useUIStore';
import { useBoardStore } from '../../stores/useBoardStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { timeAgo, cn } from '../../utils';
import { fetchVersionElements } from '../../api/version.api';
import { computeVersionDiff } from '../../services/versionDiff';

export default function VersionTimeline() {
  const open = useUIStore((s) => s.versionTimelineOpen);
  const setOpen = useUIStore((s) => s.setVersionTimeline);
  const board = useBoardStore((s) => s.board);
  const isDemo = useBoardStore((s) => s.isDemo);
  const canEdit = useBoardStore((s) => s.canEdit);
  // Newest first from the API; shown oldest → newest left to right.
  const versions = useBoardStore((s) => s.versions);
  const me = useAuthStore((s) => s.user?.id);
  const isOwner = board?.members.find((m) => m.id === me)?.role === 'owner';
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'restore' | 'save' | null>(null);
  const [compare, setCompare] = useState(true);
  const diff = useUIStore((s) => s.versionDiff);

  useEffect(() => {
    if (open) void useBoardStore.getState().loadVersions();
  }, [open, board?.id]);

  const ordered = [...versions].reverse();
  const selected = ordered.find((v) => v.id === selectedId) ?? ordered[ordered.length - 1];
  const selectedVersionId = selected?.id;

  // Live diff of the selected version against the board, drawn on the canvas.
  useEffect(() => {
    const ui = useUIStore.getState();
    if (!open || !compare || !selectedVersionId || !board?.id) {
      ui.setVersionDiff(null);
      return;
    }
    let cancelled = false;
    void fetchVersionElements(board.id, selectedVersionId).then((snapshot) => {
      if (cancelled || !snapshot) return;
      const current = useBoardStore.getState().board?.elements ?? [];
      const label = ordered.find((v) => v.id === selectedVersionId)?.label ?? '';
      useUIStore.getState().setVersionDiff({ label, ...computeVersionDiff(snapshot, current) });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, compare, selectedVersionId, board?.id, board?.elements]);

  useEffect(() => () => useUIStore.getState().setVersionDiff(null), []);

  const handleRestore = async () => {
    if (!selected || busy) return;
    setBusy('restore');
    const res = await useBoardStore.getState().restoreVersion(selected.id);
    setBusy(null);
    if (res.ok) {
      toast.success(`Restored ${selected.label}`, {
        description: 'Your previous state was saved as a "Before restore" snapshot.',
      });
      setOpen(false);
    } else {
      toast.error('Restore failed', { description: res.message });
    }
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy('save');
    const ok = await useBoardStore.getState().createVersion();
    setBusy(null);
    if (ok) toast.success('Snapshot saved');
    else toast.error('Could not save a snapshot');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="glass absolute left-1/2 top-16 z-30 w-[min(780px,calc(100%-24px))] -translate-x-1/2 rounded-2xl"
          role="dialog"
          aria-label="Version history"
        >
          <div className="px-5 py-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                <HistoryIcon size={14} className="text-ink-3" />
                Version history
                <span className="font-mono text-[10px] font-normal text-ink-3">{board?.title}</span>
              </p>
              <div className="flex items-center gap-1.5">
                {!isDemo && canEdit && (
                  <button
                    onClick={handleSave}
                    disabled={!!busy}
                    className="flex h-7 items-center gap-1.5 rounded-sm border border-line-2 px-2.5 text-[11px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink disabled:opacity-50"
                  >
                    {busy === 'save' ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                    Save snapshot
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
                  aria-label="Close version history"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {ordered.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-ink-3">
                No snapshots yet. The board is auto-saved as a snapshot after edits settle, or save one now.
              </p>
            ) : (
              <div className="flex items-start gap-2 overflow-x-auto pb-2">
                {ordered.map((v, i) => {
                  const isActive = selected?.id === v.id;
                  const isLast = i === ordered.length - 1;
                  return (
                    <div key={v.id} className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => setSelectedId(v.id)}
                        onFocus={() => setSelectedId(v.id)}
                        className={cn(
                          'group w-[150px] rounded-lg border p-2 text-left transition-all duration-150',
                          isActive ? 'border-accent/50 bg-accent-softer shadow-sm' : 'border-line hover:border-line-2 hover:bg-paper-2',
                        )}
                        aria-pressed={isActive}
                      >
                        <p className={cn('truncate text-[11.5px] font-semibold', isActive ? 'text-accent' : 'text-ink')}>
                          {v.label}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[9px] text-ink-3">
                          {v.author} · {timeAgo(v.timestamp)}
                        </p>
                        <p className="mt-1.5 line-clamp-2 text-[9.5px] leading-snug text-ink-3">{v.description}</p>
                        {isLast && <p className="mt-1 font-mono text-[8.5px] text-ink-3">latest snapshot</p>}
                      </button>
                      {!isLast && <span className="h-px w-4 bg-line-2" aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-2.5">
              <label className="flex cursor-pointer items-center gap-2 text-[11.5px] font-medium text-ink-2">
                <input
                  type="checkbox"
                  checked={compare}
                  onChange={(e) => setCompare(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                />
                Preview changes on canvas
              </label>
              {compare && diff && (
                <span className="flex items-center gap-3 font-mono text-[10px] text-ink-3" aria-live="polite">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-success" />{diff.removed.length} come back</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-warning" />{diff.changed.length} change</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-danger" />{diff.added.length} get removed</span>
                </span>
              )}
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <p className="font-mono text-[9.5px] text-ink-3">
                auto-saved after edits settle · {ordered.length} snapshot{ordered.length === 1 ? '' : 's'}
                {!isOwner && !isDemo ? ' · only owners can restore' : ''}
              </p>
              <button
                disabled={!selected || !!busy || !isOwner || isDemo}
                onClick={handleRestore}
                className="flex h-6 items-center gap-1.5 rounded-sm bg-ink px-2.5 text-[10.5px] font-medium text-paper transition-colors hover:bg-ink-hover disabled:pointer-events-none disabled:opacity-40"
              >
                {busy === 'restore' && <Loader2 size={10} className="animate-spin" />}
                {busy === 'restore' ? 'Restoring…' : 'Restore'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
