import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Download, Eye } from 'lucide-react';
import { formatFileSize } from '../../../utils';

const FILE = {
  name: 'architecture-notes.pdf',
  type: 'application/pdf',
  size: 482611,
  uploadedAt: '2 days ago',
};

export default function DocumentDemo() {
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(() => setHint(false), 4200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <div className="relative overflow-hidden rounded-lg border border-line-2 bg-board shadow-xs">
      <div className="flex h-9 items-center justify-between border-b border-line bg-paper-2/70 px-3">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">
          documentation · inline
        </span>
        <span className="font-mono text-[10px] text-ink-3">drag &amp; drop supported</span>
      </div>

      <div className="grid-paper grid-paper-fine relative flex h-[300px] items-center justify-center">
        <div className="relative flex flex-col items-center gap-5">
          <div className="flex h-[52px] w-[190px] flex-col items-center justify-center rounded-lg border border-line-2 bg-paper shadow-xs">
            <span className="text-[12.5px] font-semibold text-ink">Authentication Service</span>
            <span className="font-mono text-[9px] uppercase tracking-wide text-ink-3">node · auth</span>
          </div>

          <svg width="2" height="34" aria-hidden="true">
            <line x1="1" y1="0" x2="1" y2="34" stroke="#b0aea2" strokeWidth="1.75" strokeDasharray="4 3" />
          </svg>

          <button
            onClick={() => setOpen(true)}
            onMouseEnter={() => setHint(false)}
            className="group relative flex h-[46px] w-[210px] items-center gap-2.5 rounded-lg border border-line-2 bg-paper px-3 shadow-xs transition-all duration-150 hover:-translate-y-0.5 hover:border-line-3 hover:shadow-md"
            aria-haspopup="dialog"
            aria-label={`Preview ${FILE.name}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-danger-soft text-danger">
              <FileText size={14} />
            </span>
            <span className="min-w-0 text-left">
              <span className="block truncate text-[12px] font-semibold text-ink">{FILE.name}</span>
              <span className="block font-mono text-[9.5px] text-ink-3">
                PDF · {formatFileSize(FILE.size)} · {FILE.uploadedAt}
              </span>
            </span>
            <Eye size={13} className="ml-auto shrink-0 text-ink-3 transition-colors group-hover:text-accent" />
          </button>

          <AnimatePresence>
            {hint && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mono-label pointer-events-none absolute -bottom-7 text-[9.5px] text-ink-3"
              >
                click to preview
              </motion.span>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 6 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-1/2 top-[58px] z-10 w-[340px] -translate-x-1/2 rounded-lg border border-line-2 bg-paper shadow-lg"
                role="dialog"
                aria-label="Document preview"
              >
                <div className="flex items-center justify-between border-b border-line px-3 py-2">
                  <span className="flex items-center gap-2 text-[12px] font-medium text-ink">
                    <FileText size={13} className="text-danger" />
                    {FILE.name}
                  </span>
                  <button
                    onClick={() => setOpen(false)}
                    className="flex h-6 w-6 items-center justify-center rounded-sm text-ink-3 hover:bg-paper-2 hover:text-ink"
                    aria-label="Close preview"
                  >
                    <X size={13} />
                  </button>
                </div>

                <div className="bg-paper-2/50 p-4">
                  <div className="space-y-2.5 rounded-md border border-line bg-paper p-3">
                    <div className="h-1.5 w-24 rounded-full bg-ink/15" />
                    <div className="h-1.5 w-44 rounded-full bg-ink/10" />
                    <div className="h-1.5 w-36 rounded-full bg-ink/10" />
                    <div className="flex gap-4 pt-1">
                      <div className="flex-1 space-y-1.5">
                        <div className="h-1 w-full rounded-full bg-ink/10" />
                        <div className="h-1 w-4/5 rounded-full bg-ink/10" />
                        <div className="h-1 w-24 rounded-full bg-ink/10" />
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="h-1 w-full rounded-full bg-ink/10" />
                        <div className="h-1 w-3/5 rounded-full bg-ink/10" />
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-center font-mono text-[9.5px] text-ink-3">
                    preview · 2 of 14 pages
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-line px-3 py-2">
                  <span className="font-mono text-[9.5px] text-ink-3">
                    {formatFileSize(FILE.size)} · uploaded {FILE.uploadedAt}
                  </span>
                  <button
                    className="inline-flex h-6 items-center gap-1.5 rounded-sm bg-ink px-2.5 text-[10.5px] font-medium text-paper hover:bg-black"
                  >
                    <Download size={11} /> Open
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}