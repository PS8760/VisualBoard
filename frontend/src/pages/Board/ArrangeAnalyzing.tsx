import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useUIStore } from '../../stores/useUIStore';

/**
 * Centered "analyzing" pill shown while Auto Arrange computes the new
 * layout (a few seconds of visible feedback, with a local fallback so it
 * always resolves).
 */
export default function ArrangeAnalyzing() {
  const analyzing = useUIStore((s) => s.arrangeAnalyzing);

  return (
    <AnimatePresence>
      {analyzing && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-none absolute left-1/2 top-16 z-30 -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5 rounded-full border border-line-2 bg-paper px-4 py-2 shadow-lg">
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute h-4 w-4 animate-ping rounded-full bg-accent/30" />
              <Sparkles size={13} className="relative text-accent" />
            </span>
            <span className="text-[12px] font-medium text-ink">
              Analyzing board layout…
            </span>
            <span className="flex gap-1" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1 w-1 rounded-full bg-ink-3"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
