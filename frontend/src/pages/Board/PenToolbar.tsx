import { useToolStore } from '../../stores/useToolStore';
import { cn } from '../../utils';

const PEN_WIDTHS = [1, 2, 3, 4, 6, 8, 12];
const PEN_COLORS = [
  { name: 'Ink', value: '#1b1a17' },
  { name: 'Accent', value: '#d9480f' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Pink', value: '#db2777' },
  { name: 'Gray', value: '#6b7280' },
];

export default function PenToolbar() {
  const penWidth = useToolStore((s) => s.penWidth);
  const penColor = useToolStore((s) => s.penColor);
  const setPenWidth = useToolStore((s) => s.setPenWidth);
  const setPenColor = useToolStore((s) => s.setPenColor);

  return (
    <div className="absolute left-[60px] top-3 z-20 flex items-center gap-3 rounded-lg border border-line-2 bg-paper px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">Width</span>
        <div className="flex items-center gap-1">
          {PEN_WIDTHS.map((width) => (
            <button
              key={width}
              onClick={() => setPenWidth(width)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-sm transition-colors',
                penWidth === width
                  ? 'bg-ink text-paper'
                  : 'text-ink-2 hover:bg-paper-2 hover:text-ink',
              )}
              aria-label={`${width}px`}
              title={`${width}px`}
            >
              <div
                className="rounded-full bg-current"
                style={{ width: Math.min(width * 2, 12), height: Math.min(width * 2, 12) }}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="h-6 w-px bg-line" aria-hidden="true" />

      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">Color</span>
        <div className="flex items-center gap-1">
          {PEN_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => setPenColor(color.value)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-sm transition-all',
                penColor === color.value
                  ? 'ring-2 ring-ink ring-offset-1 ring-offset-paper'
                  : 'hover:ring-1 hover:ring-line-3',
              )}
              aria-label={color.name}
              title={color.name}
            >
              <div
                className="h-5 w-5 rounded-sm"
                style={{ backgroundColor: color.value }}
              />
            </button>
          ))}
          <input
            type="color"
            value={penColor}
            onChange={(e) => setPenColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded-sm border border-line-2"
            title="Custom color"
          />
        </div>
      </div>
    </div>
  );
}
