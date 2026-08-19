import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, Check, MousePointer2, PenLine, Square, Type } from 'lucide-react';
import { useToolStore } from '../../stores/useToolStore';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: typeof MousePointer2;
  action?: () => void;
  highlightTool?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to VisualBoard!',
    description: 'Let\'s take a quick tour of the whiteboard. You can draw, collaborate, and organize your ideas in real-time.',
    icon: MousePointer2,
  },
  {
    id: 'toolbar',
    title: 'Drawing Tools',
    description: 'Use the left toolbar to select tools. Try clicking the Rectangle tool to draw shapes.',
    icon: Square,
    highlightTool: 'rect',
    action: () => useToolStore.getState().setTool('rect'),
  },
  {
    id: 'draw',
    title: 'Click & Drag to Draw',
    description: 'Click and drag on the canvas to create shapes. Hold Shift while dragging to create perfect squares and circles.',
    icon: Square,
  },
  {
    id: 'pen',
    title: 'Freehand Drawing',
    description: 'Click the Pen tool to draw freehand. You can change pen width and color from the toolbar that appears.',
    icon: PenLine,
    highlightTool: 'pen',
    action: () => useToolStore.getState().setTool('pen'),
  },
  {
    id: 'text',
    title: 'Add Text',
    description: 'Click the Text tool, then click anywhere on the canvas to add text. Double-click any text to edit it.',
    icon: Type,
    highlightTool: 'text',
    action: () => useToolStore.getState().setTool('text'),
  },
  {
    id: 'shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Press V for Select, R for Rectangle, P for Pen, T for Text. Press Cmd/Ctrl+K to see all shortcuts.',
    icon: MousePointer2,
  },
  {
    id: 'collaborate',
    title: 'Real-Time Collaboration',
    description: 'Share the board URL with others. Everyone will see changes instantly. Try it with a teammate!',
    icon: MousePointer2,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start creating! Your work auto-saves. Press Cmd/Ctrl+Z to undo, and Escape to switch back to Select tool.',
    icon: Check,
  },
];

export default function OnboardingOverlay() {
  const [step, setStep] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if user has seen onboarding
    const seen = localStorage.getItem('vb_onboarding_seen');
    if (!seen) {
      // Show after a brief delay
      const timer = setTimeout(() => setShow(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const currentStep = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  const next = () => {
    if (currentStep.action) {
      currentStep.action();
    }
    if (isLast) {
      complete();
    } else {
      setStep(step + 1);
    }
  };

  const skip = () => {
    complete();
  };

  const complete = () => {
    localStorage.setItem('vb_onboarding_seen', 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative mx-4 w-full max-w-lg rounded-lg border border-line-2 bg-paper p-6 shadow-2xl"
        >
          <button
            onClick={skip}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
            aria-label="Skip tutorial"
          >
            <X size={16} />
          </button>

          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <currentStep.icon size={24} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-ink">{currentStep.title}</h2>
              <p className="text-[11px] font-mono text-ink-3">
                Step {step + 1} of {TUTORIAL_STEPS.length}
              </p>
            </div>
          </div>

          <p className="mb-6 text-[14px] leading-relaxed text-ink-2">
            {currentStep.description}
          </p>

          {/* Progress dots */}
          <div className="mb-6 flex items-center justify-center gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step
                    ? 'w-8 bg-accent'
                    : i < step
                    ? 'w-1.5 bg-accent/40'
                    : 'w-1.5 bg-line-2'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex h-10 items-center gap-2 rounded-sm border border-line-2 px-4 text-[13px] font-medium text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
              >
                Back
              </button>
            )}
            <button
              onClick={next}
              className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-ink px-4 py-2.5 text-[13px] font-medium text-paper transition-colors hover:bg-black"
            >
              {isLast ? 'Get Started' : 'Next'}
              {!isLast && <ArrowRight size={14} />}
            </button>
          </div>

          <button
            onClick={skip}
            className="mt-3 w-full text-center text-[12px] text-ink-3 transition-colors hover:text-ink-2"
          >
            Skip tutorial
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
