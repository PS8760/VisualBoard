import { motion, AnimatePresence } from 'framer-motion';
import { CloudOff, RefreshCw } from 'lucide-react';
import { usePresenceStore } from '../../stores/usePresenceStore';
import { useUIStore } from '../../stores/useUIStore';

export function ConnectionBanner() {
  const status = usePresenceStore((s) => s.status);

  return (
    <AnimatePresence>
      {status === 'offline' && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="absolute left-1/2 top-14 z-40 -translate-x-1/2"
          role="status"
        >
          <div className="flex items-center gap-2.5 rounded-md border border-warning/30 bg-warning-soft px-3.5 py-2 shadow-md">
            <CloudOff size={13} className="text-warning" />
            <span className="text-[12px] font-medium text-warning">
              Connection interrupted
            </span>
            <span className="font-mono text-[10px] text-warning/70">
              trying to reconnect…
            </span>
            <RefreshCw size={11} className="animate-spin text-warning/70" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ArrangeBadge() {
  const complete = useUIStore((s) => s.arrangeComplete);

  return (
    <AnimatePresence>
      {complete && (
        <motion.div
          id="arrange-badge"
          initial={{ opacity: 0, scale: 0.92, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -4 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute right-4 top-16 z-40"
        >
          <div className="flex items-center gap-2 rounded-md border border-success/25 bg-success-soft px-3 py-1.5 shadow-md">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="mono-label text-[9.5px] text-success">
              ARRANGED · LAYOUT OPTIMISED
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}