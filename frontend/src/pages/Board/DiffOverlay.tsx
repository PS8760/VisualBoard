import { useUIStore } from '../../stores/useUIStore';
import { useCanvasStore } from '../../stores/useCanvasStore';

/**
 * "Time-travel diff": outlines what restoring a version would do —
 * red = removed by the restore (added since), green dashed = comes back,
 * amber = changes.
 */
export default function DiffOverlay() {
  const diff = useUIStore((s) => s.versionDiff);
  const { x: vx, y: vy, scale } = useCanvasStore((s) => s.viewport);
  if (!diff) return null;

  const rect = (b: { x: number; y: number; w: number; h: number }, cls: string, key: string, dashed = false) => (
    <rect
      key={key}
      x={b.x * scale + vx - 4}
      y={b.y * scale + vy - 4}
      width={Math.max(8, b.w * scale + 8)}
      height={Math.max(8, b.h * scale + 8)}
      rx={8}
      className={cls}
      strokeWidth={2}
      strokeDasharray={dashed ? '6 4' : undefined}
    />
  );

  return (
    <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" aria-hidden="true">
      {diff.added.map((b, i) => rect(b, 'fill-danger/10 stroke-danger', `a${i}`))}
      {diff.changed.map((b, i) => rect(b, 'fill-warning/10 stroke-warning', `c${i}`))}
      {diff.removed.map((b, i) => rect(b, 'fill-success/10 stroke-success', `r${i}`, true))}
    </svg>
  );
}
