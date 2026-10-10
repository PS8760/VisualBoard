import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, Sparkles, Paperclip } from 'lucide-react';
import { Container, Section, SectionHeading } from '../../components/ui/Section';
import { cn } from '../../utils';
import AutoArrangeDemo from './modes/AutoArrangeDemo';
import SuggestionsDemo from './modes/SuggestionsDemo';
import DocumentDemo from './modes/DocumentDemo';

const MODES = [
  {
    id: 'arrange',
    icon: Wand2,
    title: 'Auto-Arrangement',
    description:
      'Turn a chaotic canvas into a clean, logical layout with one action. Boxes, notes and connectors settle into a readable structure.',
  },
  {
    id: 'suggest',
    icon: Sparkles,
    title: 'Architecture Suggestions',
    description:
      'Contextual engineering intelligence lives inside the board — it flags missing auth, caching or monitoring as you design, without a chatbot in sight.',
  },
  {
    id: 'documents',
    icon: Paperclip,
    title: 'Document Attachment',
    description:
      'Keep documentation attached to the exact place where it matters. Drag a file onto any element and open it with one click.',
  },
] as const;

type ModeId = (typeof MODES)[number]['id'];

export default function Modes() {
  const [active, setActive] = useState<ModeId>('arrange');

  return (
    <Section id="product" className="border-t border-line bg-paper-2/40">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[380px_1fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start" data-reveal>
            <SectionHeading
              eyebrow="Three modes"
              title="One canvas. Three ways to stay organised."
              description="VisualBoard is a plain canvas until you need structure — then it becomes a layout engine, an architecture reviewer, and a documentation shelf at once."
            />

            <div
              className="mt-10 flex flex-col gap-1.5"
              role="tablist"
              aria-label="VisualBoard modes"
              data-reveal
              data-reveal-delay="0.1"
            >
              {MODES.map((mode) => {
                const isActive = active === mode.id;
                return (
                  <button
                    key={mode.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActive(mode.id)}
                    className={cn(
                      'group relative rounded-md border px-4 py-3.5 text-left transition-all duration-200',
                      isActive
                        ? 'border-line-2 bg-paper shadow-sm'
                        : 'border-transparent hover:border-line hover:bg-paper',
                    )}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="mode-active"
                        className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-accent"
                        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                    <span className="flex items-center gap-3">
                      <mode.icon
                        size={16}
                        className={cn(
                          'transition-colors duration-150',
                          isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2',
                        )}
                      />
                      <span className="flex-1">
                        <span
                          className={cn(
                            'block text-[14px] font-semibold transition-colors duration-150',
                            isActive ? 'text-ink' : 'text-ink-2 group-hover:text-ink',
                          )}
                        >
                          {mode.title}
                        </span>
                        <AnimatePresence initial={false}>
                          {isActive && (
                            <motion.span
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25, ease: 'easeInOut' }}
                              className="block overflow-hidden"
                            >
                              <span className="block pt-1.5 text-[12.5px] leading-relaxed text-ink-2">
                                {mode.description}
                              </span>
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-[380px]" role="tabpanel" data-reveal data-reveal-delay="0.16">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {active === 'arrange' && <AutoArrangeDemo />}
                {active === 'suggest' && <SuggestionsDemo />}
                {active === 'documents' && <DocumentDemo />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </Section>
  );
}