import { motion } from 'framer-motion';
import { Highlighter, PenLine, Shapes } from 'lucide-react';
import { useToolStore } from '../../stores/useToolStore';
import { Tooltip } from '../../components/ui/Tooltip';
import { cn } from '../../utils';
import { themeInk } from '../../services/fabric.elements';

const PEN_WIDTHS = [
  { value: 2, label: 'Fine' },
  { value: 4, label: 'Medium' },
  { value: 8, label: 'Bold' },
];
const PEN_COLORS = [
  { name: 'Ink', value: '#1b1a17' },
  { name: 'Vermilion', value: '#e8590c' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Amber', value: '#f59e0b' },
];

/** Pen options, floating just above the dock while the pen is active. */
export default function PenToolbar() {
  const { penWidth, penColor, penMode, autoShape, setPenWidth, setPenColor, setPenMode, setAutoShape } = useToolStore();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.16 }}
      className="glass pointer-events-auto flex items-center gap-2 rounded-2xl px-2 py-1.5"
      role="toolbar"
      aria-label="Pen options"
    >
      <div className="flex rounded-[0.65rem] bg-paper-2 p-0.5">
        {([
          ['pen', PenLine, 'Pen'],
          ['highlighter', Highlighter, 'Highlighter'],
        ] as const).map(([mode, Icon, label]) => (
          <Tooltip key={mode} label={label} side="top">
            <button
              onClick={() => setPenMode(mode)}
              aria-pressed={penMode === mode}
              aria-label={label}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-[0.55rem] transition-colors',
                penMode === mode ? 'bg-paper text-ink shadow-xs' : 'text-ink-3 hover:text-ink',
              )}
            >
              <Icon size={15} />
            </button>
          </Tooltip>
        ))}
      </div>

      <span className="h-6 w-px bg-line-2" aria-hidden="true" />

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Color">
        {PEN_COLORS.map((c) => (
          <button
            key={c.value}
            role="radio"
            aria-checked={penColor === c.value}
            aria-label={c.name}
            title={c.name}
            onClick={() => setPenColor(c.value)}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110"
          >
            <span
              className={cn(
                'h-5 w-5 rounded-full border border-line-3',
                penColor === c.value && 'ring-2 ring-accent ring-offset-2 ring-offset-paper',
              )}
              style={{ background: themeInk(c.value) }}
            />
          </button>
        ))}
        <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full" title="Custom color">
          <span className="h-5 w-5 rounded-full border border-line-3 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)]" />
          <input
            type="color"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom color"
          />
        </label>
      </div>

      <span className="h-6 w-px bg-line-2" aria-hidden="true" />

      <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Stroke size">
        {PEN_WIDTHS.map((w) => (
          <Tooltip key={w.value} label={w.label} side="top">
            <button
              role="radio"
              aria-checked={penWidth === w.value}
              aria-label={w.label}
              onClick={() => setPenWidth(w.value)}
              className={cn('island-btn h-8 w-8', penWidth === w.value && 'bg-paper-3 text-ink')}
            >
              <span className="rounded-full bg-current" style={{ width: w.value + 2, height: w.value + 2 }} />
            </button>
          </Tooltip>
        ))}
      </div>

      <span className="h-6 w-px bg-line-2" aria-hidden="true" />

      <Tooltip label={autoShape ? 'Auto-shape on' : 'Tip: hold still at the end of a stroke to snap it'} side="top">
        <button
          onClick={() => setAutoShape(!autoShape)}
          aria-pressed={autoShape}
          aria-label="Auto-shape"
          className={cn(
            'flex h-8 items-center gap-1.5 rounded-[0.65rem] px-2.5 text-[11.5px] font-medium transition-colors',
            autoShape ? 'bg-accent text-white' : 'text-ink-2 hover:bg-paper-3 hover:text-ink',
          )}
        >
          <Shapes size={14} /> Auto-shape
        </button>
      </Tooltip>
    </motion.div>
  );
}
