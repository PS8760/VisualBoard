import type { Pt } from '../geometry';
import type { ConnectorModel, Marker } from './model';
import { pointAt, type ConnectorPath } from './route';

/**
 * Canvas rendering for connectors: path, end markers, mid-line label pill and
 * interaction effects (hover glow, selection halo, animated flow).
 * Works in world coordinates; callers translate the context.
 */

export interface DrawOptions {
  /** Theme-adapted stroke color. */
  stroke: string;
  selected?: boolean;
  hovered?: boolean;
  /** Dash offset for animated flow (marching ants). */
  flowOffset?: number;
  dark?: boolean;
}

const DASHES: Record<ConnectorModel['strokeStyle'], number[]> = { solid: [], dashed: [10, 7], dotted: [1.5, 6] };

export function tracePath(ctx: CanvasRenderingContext2D, path: ConnectorPath) {
  ctx.beginPath();
  ctx.moveTo(path.start.x, path.start.y);
  for (const s of path.segs) {
    if (s.type === 'L') ctx.lineTo(s.to.x, s.to.y);
    else if (s.type === 'Q') ctx.quadraticCurveTo(s.c.x, s.c.y, s.to.x, s.to.y);
    else ctx.bezierCurveTo(s.c1.x, s.c1.y, s.c2.x, s.c2.y, s.to.x, s.to.y);
  }
}

/** Marker size scales gently with stroke width. */
export const markerSize = (strokeWidth: number) => 7 + strokeWidth * 2.4;

/**
 * Draws a marker with its tip at `tip`, pointing along `dir` (direction of
 * travel into the tip).
 */
export function drawMarker(ctx: CanvasRenderingContext2D, marker: Marker, tip: Pt, dir: Pt, size: number, color: string, paper: string, lineWidth: number) {
  if (marker === 'none') return;
  const angle = Math.atan2(dir.y, dir.x);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.setLineDash([]);
  const s = size;
  ctx.beginPath();
  switch (marker) {
    case 'arrow':
      ctx.moveTo(-s, -s * 0.5);
      ctx.lineTo(0, 0);
      ctx.lineTo(-s, s * 0.5);
      ctx.stroke();
      break;
    case 'stealth':
      ctx.moveTo(0, 0);
      ctx.lineTo(-s * 1.1, -s * 0.5);
      ctx.lineTo(-s * 0.75, 0);
      ctx.lineTo(-s * 1.1, s * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    case 'triangle':
    case 'triangle-open':
      ctx.moveTo(0, 0);
      ctx.lineTo(-s, -s * 0.48);
      ctx.lineTo(-s, s * 0.48);
      ctx.closePath();
      if (marker === 'triangle') ctx.fill();
      else {
        ctx.fillStyle = paper;
        ctx.fill();
        ctx.stroke();
      }
      break;
    case 'circle':
      ctx.arc(-s * 0.4, 0, s * 0.4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'diamond':
      ctx.moveTo(0, 0);
      ctx.lineTo(-s * 0.6, -s * 0.42);
      ctx.lineTo(-s * 1.2, 0);
      ctx.lineTo(-s * 0.6, s * 0.42);
      ctx.closePath();
      ctx.fill();
      break;
    case 'bar':
      ctx.lineWidth = Math.max(lineWidth, 2);
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(0, s * 0.55);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** How far filled markers extend back from the tip (the stroke stops there). */
export function markerInset(marker: Marker, size: number): number {
  switch (marker) {
    case 'stealth':
      return size * 0.75;
    case 'triangle':
    case 'triangle-open':
      return size * 0.9;
    case 'circle':
      return size * 0.8;
    case 'diamond':
      return size * 1.15;
    default:
      return 0;
  }
}

export const LABEL_FONT = '500 12px Inter, ui-sans-serif, system-ui, sans-serif';

/** Size of the label pill in world units. */
export function labelBox(ctx: CanvasRenderingContext2D | null, text: string) {
  let w = text.length * 6.6;
  if (ctx) {
    ctx.save();
    ctx.font = LABEL_FONT;
    w = ctx.measureText(text).width;
    ctx.restore();
  }
  return { w: Math.ceil(w) + 16, h: 22 };
}

export function drawConnector(ctx: CanvasRenderingContext2D, path: ConnectorPath, model: ConnectorModel, opts: DrawOptions) {
  const width = model.strokeWidth;
  const size = markerSize(width);
  const paper = opts.dark ? '#1f1e1b' : '#fdfdfc';

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';

  // Selection halo / hover glow under the stroke.
  if (opts.selected || opts.hovered) {
    tracePath(ctx, path);
    ctx.strokeStyle = opts.selected ? 'rgba(232, 89, 12, 0.28)' : 'rgba(232, 89, 12, 0.16)';
    ctx.lineWidth = width + (opts.selected ? 8 : 6);
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // Stop the stroke where filled markers begin so it never pokes through.
  const startInset = markerInset(model.startMarker, size);
  const endInset = markerInset(model.endMarker, size);
  ctx.save();
  if (startInset || endInset) {
    // Clip out disks at the tips (cheap and exact for every path type).
    ctx.beginPath();
    ctx.rect(path.bbox.x - 1000, path.bbox.y - 1000, path.bbox.w + 2000, path.bbox.h + 2000);
    if (startInset) ctx.arc(path.start.x, path.start.y, startInset, 0, Math.PI * 2, true);
    if (endInset) {
      ctx.moveTo(path.end.x + endInset, path.end.y);
      ctx.arc(path.end.x, path.end.y, endInset, 0, Math.PI * 2, true);
    }
    ctx.clip('evenodd');
  }
  tracePath(ctx, path);
  ctx.strokeStyle = opts.stroke;
  ctx.lineWidth = width;
  if (model.animated) {
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -(opts.flowOffset ?? 0);
  } else {
    ctx.setLineDash(DASHES[model.strokeStyle]);
    if (model.strokeStyle === 'dotted') ctx.lineCap = 'round';
  }
  ctx.stroke();
  ctx.restore();

  drawMarker(ctx, model.startMarker, path.start, path.startDir, size, opts.stroke, paper, width);
  drawMarker(ctx, model.endMarker, path.end, path.endDir, size, opts.stroke, paper, width);

  if (model.label) {
    const { point } = pointAt(path, model.labelT);
    const box = labelBox(ctx, model.label);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(point.x - box.w / 2, point.y - box.h / 2, box.w, box.h, 7);
    ctx.fillStyle = paper;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = opts.dark ? '#45423b' : '#d6d4cb';
    ctx.stroke();
    ctx.font = LABEL_FONT;
    ctx.fillStyle = opts.dark ? '#ebe8df' : '#1b1a17';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(model.label, point.x, point.y + 0.5);
  }
  ctx.restore();
}
