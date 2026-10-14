import { useEffect, useRef } from 'react';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { FADE_MS, liveTrails, onLaserChange } from '../../services/laser';

/**
 * Renders laser-pointer trails (yours and collaborators') as glowing,
 * fading strokes. Runs a rAF loop only while trails are alive.
 */
export default function LaserOverlay() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let frame: number | null = null;

    const draw = () => {
      frame = null;
      const ctx = canvas.getContext('2d');
      const container = useCanvasStore.getState().container;
      if (!ctx || !container) return;
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const { x: vx, y: vy, scale } = useCanvasStore.getState().viewport;
      const now = performance.now();
      const trails = liveTrails(now);
      for (const trail of trails) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const pts = trail.points;
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]!;
          const b = pts[i]!;
          if (Number.isNaN(a.x) || Number.isNaN(b.x)) continue;
          const life = 1 - (now - b.t) / FADE_MS;
          if (life <= 0) continue;
          ctx.strokeStyle = trail.color;
          ctx.globalAlpha = life;
          ctx.shadowColor = trail.color;
          ctx.shadowBlur = 12 * life;
          ctx.lineWidth = 2 + 4 * life;
          ctx.beginPath();
          ctx.moveTo(a.x * scale + vx, a.y * scale + vy);
          ctx.lineTo(b.x * scale + vx, b.y * scale + vy);
          ctx.stroke();
        }
        // Bright dot at the head.
        const head = [...pts].reverse().find((p) => !Number.isNaN(p.x));
        if (head && now - head.t < FADE_MS) {
          ctx.globalAlpha = 1 - (now - head.t) / FADE_MS;
          ctx.shadowBlur = 16;
          ctx.fillStyle = trail.color;
          ctx.beginPath();
          ctx.arc(head.x * scale + vx, head.y * scale + vy, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      if (trails.length) frame = requestAnimationFrame(draw);
    };

    const kick = () => {
      if (frame === null) frame = requestAnimationFrame(draw);
    };
    const off = onLaserChange(kick);
    return () => {
      off();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 z-20" aria-hidden="true" />;
}
