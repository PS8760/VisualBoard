import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Keyboard, Mouse, Users, Save, PlayCircle } from 'lucide-react';
import { REPLAY_TOUR_EVENT } from '../../utils/shortcuts';

export default function HelpButton() {
  const [show, setShow] = useState(false);

  // Opened from the navigation island's "?" button or the ? key.
  useEffect(() => {
    const open = () => setShow(true);
    window.addEventListener('vb:open-help', open);
    return () => window.removeEventListener('vb:open-help', open);
  }, []);

  return (
    <>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShow(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-line-2 bg-paper p-6 shadow-2xl"
            >
              <button
                onClick={() => setShow(false)}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
                aria-label="Close help"
              >
                <X size={16} />
              </button>

              <div className="mb-6 flex flex-wrap items-center gap-3 pr-10">
                <h2 className="text-2xl font-semibold text-ink">Quick Reference Guide</h2>
                <button
                  onClick={() => {
                    setShow(false);
                    window.dispatchEvent(new Event(REPLAY_TOUR_EVENT));
                  }}
                  className="flex h-8 items-center gap-1.5 rounded-sm border border-line-2 px-3 text-[12px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  <PlayCircle size={13} /> Replay tour
                </button>
              </div>

              {/* Drawing Tools */}
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <Mouse size={18} className="text-accent" />
                  <h3 className="text-lg font-semibold text-ink">Drawing Tools</h3>
                </div>
                <div className="space-y-2 rounded-md bg-paper-2 p-4">
                  <HelpItem shortcut="V" description="Select tool - Click elements to select" />
                  <HelpItem shortcut="H" description="Hand tool - Pan around the canvas" />
                  <HelpItem shortcut="P" description="Pen tool - Draw freehand" />
                  <HelpItem shortcut="R" description="Rectangle - Click & drag to draw" />
                  <HelpItem shortcut="O" description="Circle - Click & drag to draw" />
                  <HelpItem shortcut="L" description="Line - Draw straight lines" />
                  <HelpItem shortcut="A" description="Connector - Drag from shape to shape; it stays attached when they move" />
                  <HelpItem shortcut="T" description="Text - Click to add text" />
                  <HelpItem shortcut="S" description="Sticky Note - Add yellow sticky notes" />
                  <HelpItem shortcut="I" description="Image - Place an image on the canvas" />
                  <HelpItem shortcut="D" description="Document - Attach files" />
                  <HelpItem shortcut="C" description="Comment - Add comments" />
                  <HelpItem shortcut="K" description="Laser pointer - Fading trail everyone sees" />
                  <HelpItem shortcut="↵" description="Edit the label of the selected shape (or double-click)" />
                  <HelpItem shortcut="Hold" description="Pen - Hold still at the end of a stroke to snap it to a shape" />
                </div>
              </section>

              {/* Drawing Tips */}
              <section className="mb-6">
                <h3 className="mb-3 text-lg font-semibold text-ink">Drawing Tips</h3>
                <div className="space-y-2 rounded-md bg-paper-2 p-4">
                  <TipItem
                    title="Perfect Shapes"
                    description="Hold Shift while dragging to create perfect squares and circles"
                  />
                  <TipItem
                    title="Straight Lines"
                    description="Hold Shift while dragging lines or arrows to snap to 45° angles"
                  />
                  <TipItem
                    title="Double-Click"
                    description="Double-click text or sticky notes to edit them"
                  />
                  <TipItem
                    title="Properties"
                    description="Select elements and use the right panel to change colors, size, and opacity"
                  />
                </div>
              </section>

              {/* Keyboard Shortcuts */}
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <Keyboard size={18} className="text-accent" />
                  <h3 className="text-lg font-semibold text-ink">Keyboard Shortcuts</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2 rounded-md bg-paper-2 p-4">
                    <h4 className="mb-2 text-[11px] font-mono uppercase tracking-wide text-ink-3">
                      Actions
                    </h4>
                    <HelpItem shortcut="⌘ C" description="Copy selected" />
                    <HelpItem shortcut="⌘ V" description="Paste" />
                    <HelpItem shortcut="⌘ D" description="Duplicate" />
                    <HelpItem shortcut="⌘ A" description="Select all" />
                    <HelpItem shortcut="⌘ Z" description="Undo" />
                    <HelpItem shortcut="⌘ ⇧ Z" description="Redo" />
                    <HelpItem shortcut="Del" description="Delete" />
                    <HelpItem shortcut="⌘ ] / ⌘ [" description="Bring to front / send to back" />
                    <HelpItem shortcut="⌘ L" description="Lock / unlock" />
                  </div>
                  <div className="space-y-2 rounded-md bg-paper-2 p-4">
                    <h4 className="mb-2 text-[11px] font-mono uppercase tracking-wide text-ink-3">
                      View
                    </h4>
                    <HelpItem shortcut="Space" description="Temporary pan" />
                    <HelpItem shortcut="⇧ 1" description="Fit to content" />
                    <HelpItem shortcut="M" description="Toggle minimap" />
                    <HelpItem shortcut="⌘ ." description="Zen mode (hide all UI)" />
                    <HelpItem shortcut="Alt" description="Hold while moving to skip smart guides" />
                    <HelpItem shortcut="1" description="100% zoom" />
                    <HelpItem shortcut="2" description="50% zoom" />
                    <HelpItem shortcut="0" description="Fit canvas" />
                    <HelpItem shortcut="⌘ +" description="Zoom in" />
                    <HelpItem shortcut="⌘ −" description="Zoom out" />
                    <HelpItem shortcut="G" description="Toggle grid" />
                  </div>
                </div>
              </section>

              {/* Collaboration */}
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <Users size={18} className="text-accent" />
                  <h3 className="text-lg font-semibold text-ink">Collaboration</h3>
                </div>
                <div className="space-y-2 rounded-md bg-paper-2 p-4">
                  <TipItem
                    title="Share Link"
                    description="Click Share in the top bar to copy the board link"
                  />
                  <TipItem
                    title="Real-Time"
                    description="All changes sync instantly to everyone viewing the board"
                  />
                  <TipItem
                    title="Cursors"
                    description="See where your teammates are working with live cursors"
                  />
                  <TipItem title="Comments" description="Use comment tool (C) to leave feedback" />
                </div>
              </section>

              {/* Auto-Save */}
              <section className="mb-2">
                <div className="mb-3 flex items-center gap-2">
                  <Save size={18} className="text-accent" />
                  <h3 className="text-lg font-semibold text-ink">Auto-Save & Versions</h3>
                </div>
                <div className="space-y-2 rounded-md bg-paper-2 p-4">
                  <TipItem title="Auto-Save" description="Your work saves automatically every second" />
                  <TipItem
                    title="Versions"
                    description="Create snapshots to save important milestones"
                  />
                  <TipItem
                    title="Offline"
                    description="Changes are queued and sync when you reconnect"
                  />
                </div>
              </section>

              <div className="mt-6 rounded-md border border-accent/20 bg-accent-softer p-4">
                <p className="text-[13px] leading-relaxed text-ink-2">
                  <strong className="text-ink">Pro Tip:</strong> Press{' '}
                  <kbd className="rounded border border-line-2 bg-paper px-1.5 py-0.5 font-mono text-[11px]">
                    ⌘ K
                  </kbd>{' '}
                  to open the command palette and search for any action!
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function HelpItem({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[12px]">
      <span className="text-ink-2">{description}</span>
      <kbd className="shrink-0 rounded border border-line-2 bg-paper px-2 py-1 font-mono text-[11px] text-ink-3">
        {shortcut}
      </kbd>
    </div>
  );
}

function TipItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-[12px]">
      <h5 className="font-semibold text-ink">{title}</h5>
      <p className="text-ink-3">{description}</p>
    </div>
  );
}
