import { motion } from 'framer-motion';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { usePresenceStore } from '../../stores/usePresenceStore';

/**
 * Renders remote (and own) cursors on top of the canvas.
 * World coordinates → screen coordinates via the viewport store.
 */
export default function CursorsOverlay() {
  const users = usePresenceStore((s) => s.users);
  const viewport = useCanvasStore((s) => s.viewport);
  const container = useCanvasStore((s) => s.container);

  if (!container || !users.length) return null;

  const { width, height } = container.getBoundingClientRect();
  const { x: vx, y: vy, scale } = viewport;

  const screen = (wx: number, wy: number) => ({
    x: wx * scale + vx,
    y: wy * scale + vy,
  });

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {users.map((u) => {
        if (!u.cursor) return null;
        const pos = screen(u.cursor.x, u.cursor.y);
        const offscreen =
          pos.x < -40 || pos.y < -40 || pos.x > width + 40 || pos.y > height + 40;
        if (offscreen) return null;

        return (
          <motion.div
            key={u.id}
            className="absolute pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1, x: pos.x, y: pos.y }}
            transition={{ duration: 0.15, x: { duration: 0.08 }, y: { duration: 0.08 } }}
            style={{ left: 0, top: 0 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M5.5 3.2l12.8 6.8-6 2.2-3.4 6L5.5 3.2z"
                fill={u.color}
                stroke="#fff"
                strokeWidth="1.4"
              />
            </svg>
            <span
              className="absolute left-3 top-2.5 flex h-[18px] items-center whitespace-nowrap rounded-sm px-1.5 text-[9.5px] font-medium text-white"
              style={{ background: u.color }}
            >
              {u.name}
              {u.cursor.tool === 'pen' && <span className="ml-1 opacity-70">· drawing</span>}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}