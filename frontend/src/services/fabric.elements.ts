import {
  Canvas,
  Rect,
  Circle,
  Line,
  IText,
  Textbox,
  Group,
  Path,
  FabricImage,
  FabricObject,
  util,
  type TPointerEventInfo,
  type TPointerEvent,
} from 'fabric';
import type { AttachmentMeta, BoardElement, ElementKind } from '../types';
import { uid } from '../utils';
import { ConnectorShape } from './connectors/shape';
export { ConnectorShape } from './connectors/shape';
import { readConnector } from './connectors/model';

/*
 * Fabric 7 positions objects by their CENTER by default. Every coordinate in
 * this app (element x/y, overlays, auto-arrange, the backend layout engine,
 * persisted data) is top-left based, so pin the origin globally before any
 * object is constructed. Without this, shapes jumped by half their size on
 * creation and attachment/comment overlays drifted off their elements.
 */
FabricObject.ownDefaults.originX = 'left';
FabricObject.ownDefaults.originY = 'top';

export interface VBData {
  id?: string;
  kind?: ElementKind;
  attachment?: AttachmentMeta | null;
}

/** A fabric path segment, e.g. ["M", x, y] or ["Q", cx, cy, x, y]. */
export type TPathData = Array<[string, ...number[]]>;

/** Converts fabric path segments into a flat [x0,y0,x1,y1,...] point list. */
export function flattenPathPoints(segments: Array<unknown[] | [string, ...number[]]>): number[] {
  const points: number[] = [];
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      const v = seg[i];
      if (typeof v === 'number' && Number.isFinite(v)) points.push(v);
    }
  }
  return points;
}

export type VBObj = FabricObject & { data?: VBData };

export const CANVAS_COLORS = {
  nodeFill: '#fafaf8',
  nodeStroke: '#c2c0b5',
  accentStroke: '#d9480f',
  stickyFill: '#fdeeb0',
  stickyStroke: '#e6cf74',
  docFill: '#fbf1e8',
  penStroke: '#1b1a17',
  lineStroke: '#a8a69c',
  commentFill: '#d9480f',
};

export { isDarkTheme, themeInk } from './ink';
import { themeInk } from './ink';

/** Shown in a freshly created text element until the user types. */
export const TEXT_PLACEHOLDER = 'Type something…';

export const asVB = (obj: FabricObject): VBObj => obj as VBObj;

export function elementId(obj: FabricObject): string | undefined {
  return asVB(obj).data?.id;
}

export function elementKind(obj: FabricObject): ElementKind | undefined {
  return asVB(obj).data?.kind;
}

/* ------------------------------------------------------------------------ */
/* Labelled shapes                                                          */
/* ------------------------------------------------------------------------ */

export const LABEL_COLOR = '#1b1a17';
const LABEL_FONT = 'Inter, ui-sans-serif, system-ui, sans-serif';

/** Word-wraps `text` into lines no wider than `maxWidth` (hard-breaks long words). */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
        // Hard-break a single word wider than the box.
        while (ctx.measureText(line).width > maxWidth && line.length > 1) {
          let cut = line.length - 1;
          while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
          out.push(line.slice(0, cut));
          line = line.slice(cut);
        }
      } else {
        out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

/** Draws a centered, wrapped label inside a w×h box centered on the origin. */
function drawLabel(ctx: CanvasRenderingContext2D, label: string, w: number, h: number, size: number, color: string) {
  if (!label) return;
  ctx.save();
  ctx.font = `500 ${size}px ${LABEL_FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = size * 1.3;
  const maxLines = Math.max(1, Math.floor((h - 8) / lineHeight));
  let lines = wrapText(ctx, label, Math.max(8, w - 16));
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/.$/, '')}…`;
  }
  const startY = -((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, 0, startY + i * lineHeight));
  ctx.restore();
}

interface Labelled {
  label: string;
  labelSize: number;
  labelColor: string;
  /** Hidden while the DOM label editor is open so text isn't drawn twice. */
  labelHidden: boolean;
}

/** Rectangle that renders its element `content` as a centered, wrapped label. */
export class LabeledRect extends Rect implements Labelled {
  static override type = 'LabeledRect';
  label = '';
  labelSize = 14;
  labelColor = LABEL_COLOR;
  labelHidden = false;

  override _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);
    if (!this.labelHidden) drawLabel(ctx, this.label, this.width, this.height, this.labelSize, this.labelColor);
  }
}

/** Circle with the same label behaviour (wrapped within the inscribed square). */
export class LabeledCircle extends Circle implements Labelled {
  static override type = 'LabeledCircle';
  label = '';
  labelSize = 14;
  labelColor = LABEL_COLOR;
  labelHidden = false;

  override _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);
    const side = (this.radius ?? 0) * Math.SQRT2;
    if (!this.labelHidden) drawLabel(ctx, this.label, side, side, this.labelSize, this.labelColor);
  }
}

export function isLabelled(obj: FabricObject | null | undefined): obj is (LabeledRect | LabeledCircle) {
  return obj instanceof LabeledRect || obj instanceof LabeledCircle;
}

/** Locked elements stay selectable (to unlock them) but can't be transformed. */
export function applyLock(obj: FabricObject, locked: boolean | undefined) {
  if (!locked) return obj;
  obj.set({
    lockMovementX: true,
    lockMovementY: true,
    lockScalingX: true,
    lockScalingY: true,
    lockRotation: true,
    hasControls: false,
    hoverCursor: 'not-allowed',
  });
  return obj;
}

interface MaterialOptions {
  selectable?: boolean;
  evented?: boolean;
}

const DASHES: Record<string, number[] | null> = { solid: null, dashed: [10, 7], dotted: [1.5, 6] };

export function materializeElement(el: BoardElement, opts: MaterialOptions = {}): FabricObject {
  const obj = buildObject(el, opts);
  const dash = el.strokeStyle ? DASHES[el.strokeStyle] : null;
  if (dash && el.kind !== 'text' && el.kind !== 'sticky' && el.kind !== 'document') {
    obj.set({ strokeDashArray: dash, strokeLineCap: 'round' });
  }
  return applyLock(obj, el.locked);
}



function buildObject(el: BoardElement, opts: MaterialOptions): FabricObject {
  const shared = {
    left: el.x,
    top: el.y,
    angle: el.rotation,
    scaleX: el.scaleX ?? 1,
    scaleY: el.scaleY ?? 1,
    opacity: el.opacity ?? 1,
    selectable: opts.selectable ?? true,
    evented: opts.evented ?? true,
    data: { id: el.id, kind: el.kind, attachment: el.attachment },
  };

  switch (el.kind) {
    case 'rect': {
      const rect = new LabeledRect({
        ...shared,
        width: el.width,
        height: el.height,
        rx: el.radius ?? 8,
        ry: el.radius ?? 8,
        fill: el.fill || CANVAS_COLORS.nodeFill,
        stroke: themeInk(el.stroke || CANVAS_COLORS.nodeStroke),
        strokeWidth: el.strokeWidth ?? 1.5,
      });
      rect.label = el.content ?? '';
      rect.labelSize = el.fontSize ?? 14;
      // Labels sit on the shape's fill; on a see-through shape they sit on the canvas.
      rect.labelColor = el.fill === 'transparent' ? themeInk(el.textColor ?? LABEL_COLOR)! : el.textColor ?? LABEL_COLOR;
      return rect;
    }
    case 'circle': {
      const circle = new LabeledCircle({
        ...shared,
        radius: Math.min(el.width, el.height) / 2,
        fill: el.fill || CANVAS_COLORS.nodeFill,
        stroke: themeInk(el.stroke || CANVAS_COLORS.nodeStroke),
        strokeWidth: el.strokeWidth ?? 1.5,
      });
      circle.label = el.content ?? '';
      circle.labelSize = el.fontSize ?? 14;
      circle.labelColor = el.fill === 'transparent' ? themeInk(el.textColor ?? LABEL_COLOR)! : el.textColor ?? LABEL_COLOR;
      return circle;
    }
    case 'sticky': {
      const bg = new Rect({
        width: el.width,
        height: el.height,
        rx: 6,
        ry: 6,
        fill: el.fill || CANVAS_COLORS.stickyFill,
        stroke: el.stroke || CANVAS_COLORS.stickyStroke,
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      // Textbox (not IText) so the note's text wraps inside the note.
      const text = new Textbox(el.content ?? 'Write a note…', {
        left: 12,
        top: 12,
        width: Math.max(20, el.width - 24),
        fontSize: el.fontSize ?? 14,
        lineHeight: 1.25,
        fontFamily: 'Inter',
        fill: '#4a3f16',
        selectable: false,
        evented: false,
        editable: false,
        splitByGrapheme: false,
      });
      const group = new Group([bg, text], {
        ...shared,
        left: el.x,
        top: el.y,
        subTargetCheck: true,
      });
      asVB(group).data = shared.data;
      return group;
    }
    case 'line':
    case 'arrow':
      // Routed, anchored connector (see services/connectors).
      return new ConnectorShape(readConnector(el), el.id, {
        selectable: shared.selectable,
        evented: shared.evented,
        opacity: shared.opacity,
        data: shared.data,
      } as Partial<FabricObject>) as unknown as FabricObject;
    case 'pen': {
      const stroke = themeInk(el.stroke || CANVAS_COLORS.penStroke)!;
      const strokeWidth = el.strokeWidth || 2;
      const penShared = {
        ...shared,
        stroke,
        strokeWidth,
        fill: null,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      };
      let pathData: unknown = null;
      if (el.pointsToPath) {
        try {
          const parsed = JSON.parse(el.pointsToPath);
          if (Array.isArray(parsed)) pathData = parsed;
        } catch {
          pathData = el.pointsToPath;
        }
      }
      if (!pathData && el.points && el.points.length >= 4) {
        pathData = pathFromPoints(el.points);
      }
      if (pathData) {
        const PenPath = Path as unknown as new (
          path: unknown,
          options: Record<string, unknown>,
        ) => Path;
        return new PenPath(pathData, penShared);
      }
      return new Rect({ ...shared, width: 1, height: 1, fill: 'transparent', stroke: 'transparent' });
    }
    case 'text':
      return new IText(el.content ?? TEXT_PLACEHOLDER, {
        ...shared,
        fontSize: el.fontSize ?? 18,
        fontFamily: 'Inter',
        fill: themeInk(el.textColor ?? '#1b1a17'),
      });
    case 'document': {
      const bg = new Rect({
        width: el.width,
        height: el.height,
        rx: 6,
        ry: 6,
        fill: el.fill || CANVAS_COLORS.docFill,
        stroke: el.stroke || '#e0a883',
        strokeWidth: 1,
        selectable: false,
        evented: false,
      });
      const text = new IText(el.content ?? 'document.pdf', {
        left: 12,
        top: el.height / 2 - 8,
        fontSize: el.fontSize ?? 12,
        fontFamily: 'IBM Plex Mono',
        fill: '#8a4a1c',
        selectable: false,
        evented: false,
      });
      return new Group([bg, text], {
        ...shared,
        left: el.x,
        top: el.y,
        subTargetCheck: false,
      });
    }
    case 'image': {
      // Size from the element (displayed size), not the bitmap: the bitmap
      // loads asynchronously and has no dimensions yet, so computing a scale
      // here divided by zero.
      const imgEl = new Image();
      const img = new FabricImage(imgEl, {
        ...shared,
        scaleX: 1,
        scaleY: 1,
        width: el.width,
        height: el.height,
        objectCaching: false,
      });
      imgEl.onload = () => {
        const w = imgEl.naturalWidth || el.width;
        const h = imgEl.naturalHeight || el.height;
        img.set({ width: w, height: h, scaleX: el.width / w, scaleY: el.height / h });
        img.setCoords();
        img.canvas?.requestRenderAll();
      };
      imgEl.src = el.content;
      return img;
    }
    case 'comment':
      return new Circle({
        ...shared,
        radius: 9,
        fill: el.fill || CANVAS_COLORS.commentFill,
        stroke: '#ffffff',
        strokeWidth: 2,
      });
    default:
      return new Rect({ ...shared, width: 100, height: 50, fill: '#eee' });
  }
}

export function pathFromPoints(points: number[]): string {
  if (points.length < 4) return '';
  let d = `M ${points[0]} ${points[1]}`;
  for (let i = 2; i < points.length - 1; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    d += ` L ${x} ${y}`;
  }
  return d;
}

/** Reads a fabric object back into a BoardElement. */
export function serializeElement(obj: FabricObject): BoardElement | null {
  const id = elementId(obj);
  if (!id) return null;
  const kind = elementKind(obj) ?? 'rect';
  const data = asVB(obj).data ?? {};

  const common = {
    id,
    kind,
    x: obj.left ?? 0,
    y: obj.top ?? 0,
    width: obj.width ?? 0,
    height: obj.height ?? 0,
    rotation: obj.angle ?? 0,
    scaleX: obj.scaleX ?? 1,
    scaleY: obj.scaleY ?? 1,
    fill: (obj.fill as string) ?? '#fafaf8',
    stroke: (obj.stroke as string) ?? '#c2c0b5',
    strokeWidth: obj.strokeWidth ?? 1.5,
    content: '',
    attachment: data.attachment ?? null,
    version: 0,
  } as BoardElement;

  if (obj instanceof ConnectorShape) {
    return { ...common, fill: 'transparent', content: '', ...obj.toElementPatch() } as BoardElement;
  }
  if (obj instanceof Line) {
    // Temporary drawing preview (always unrotated): absolute endpoints.
    const { x1, y1, x2, y2 } = obj as unknown as { x1: number; y1: number; x2: number; y2: number };
    return {
      ...common,
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      fill: 'transparent',
      content: '',
      points: [x1, y1, x2, y2],
      pointsAbsolute: true,
    };
  }
  if (isLabelled(obj)) {
    const base = obj instanceof LabeledCircle
      ? { width: (obj.radius ?? 1) * 2, height: (obj.radius ?? 1) * 2 }
      : {};
    return { ...common, ...base, content: obj.label, fontSize: obj.labelSize };
  }
  if (obj instanceof Path) {
    const segments = obj.path as unknown as TPathData;
    return {
      ...common,
      content: '',
      stroke: (obj.stroke as string) ?? CANVAS_COLORS.penStroke,
      strokeWidth: obj.strokeWidth ?? 2,
      points: flattenPathPoints(segments),
      pointsToPath: segments && segments.length ? JSON.stringify(segments) : undefined,
    };
  }
  if (obj instanceof IText) {
    return { ...common, content: obj.text ?? '', fontSize: obj.fontSize };
  }
  if (obj instanceof FabricImage) {
    // Images persist their displayed size; the bitmap scale is derived on load.
    return {
      ...common,
      width: obj.getScaledWidth(),
      height: obj.getScaledHeight(),
      scaleX: 1,
      scaleY: 1,
      content: (obj.getElement() as HTMLImageElement).src ?? '',
    };
  }
  if (obj instanceof Group) {
    const children = obj.getObjects();
    const textObj = children.find((o) => o instanceof IText) as IText | undefined;
    // Group bounds include the background stroke; persisting them made cards
    // grow by a pixel on every save. The background rect is the true size.
    const bg = children.find((o) => o instanceof Rect) as Rect | undefined;
    return {
      ...common,
      width: bg?.width ?? common.width,
      height: bg?.height ?? common.height,
      fill: (bg?.fill as string) ?? common.fill,
      stroke: (bg?.stroke as string) ?? common.stroke,
      content: textObj?.text ?? '',
      fontSize: textObj?.fontSize,
    };
  }
  if (obj instanceof Circle) {
    const r = obj.radius ?? 1;
    return { ...common, width: r * 2, height: r * 2, fill: obj.fill as string, stroke: obj.stroke as string };
  }
  return common;
}

/** Key-order independent JSON (jsonb from the server reorders keys). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .filter((k) => (value as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * Everything that affects how an element renders. Server bookkeeping
 * (version, legacy counters) is excluded so an ack that only bumps the
 * version never forces the canvas object to be rebuilt.
 */
export function renderSignature(el: BoardElement): string {
  const { version: _version, commentCount: _count, ...rest } = el;
  void _version;
  void _count;
  return canonical(rest);
}

/**
 * World-space center, rotation and scale of an object — correct even for
 * members of an ActiveSelection, whose own left/top/angle are relative to the
 * selection rather than the canvas.
 */
export function worldTransform(obj: FabricObject) {
  const d = util.qrDecompose(obj.calcTransformMatrix());
  return { cx: d.translateX, cy: d.translateY, angle: d.angle, scaleX: d.scaleX, scaleY: d.scaleY };
}

export const GRID_SIZE = 20;

/** Snaps a value to the nearest grid increment. */
export function snapToGrid(v: number, grid = GRID_SIZE): number {
  return Math.round(v / grid) * grid;
}

/** Snaps a point to the nearest grid position. */
export function snapPointToGrid(p: { x: number; y: number }, grid = GRID_SIZE) {
  return { x: snapToGrid(p.x, grid), y: snapToGrid(p.y, grid) };
}

export interface DrawingState {
  object: FabricObject | null;
  kind: ElementKind;
  origin: { x: number; y: number };
  type: 'shape' | 'text';
}

/** Dimension info emitted during live drawing for the HUD overlay. */
export interface DrawingDimensions {
  w: number;
  h: number;
  label: string;
}

/** Creates a placeholder object for a shape/line/arrow draw gesture. */
export function startDrawing(canvas: Canvas, kind: ElementKind, point: { x: number; y: number }): DrawingState {
  const common = {
    left: point.x,
    top: point.y,
    selectable: false,
    evented: false,
    data: { id: `tmp_${Date.now()}`, kind },
  };

  let object: FabricObject | null;
  let type: DrawingState['type'] = 'shape';

  switch (kind) {
    case 'rect':
      object = new Rect({ ...common, width: 1, height: 1, rx: 8, ry: 8, fill: 'rgba(250,250,248,0.45)', stroke: CANVAS_COLORS.nodeStroke, strokeWidth: 1.5 });
      break;
    case 'circle':
      object = new Circle({ ...common, radius: 1, fill: CANVAS_COLORS.nodeFill, stroke: CANVAS_COLORS.nodeStroke, strokeWidth: 1.5 });
      break;
    case 'sticky':
      object = new Rect({ ...common, width: 140, height: 140, rx: 6, ry: 6, fill: CANVAS_COLORS.stickyFill, stroke: CANVAS_COLORS.stickyStroke, strokeWidth: 1 });
      break;
    case 'line':
      object = new Line([point.x, point.y, point.x, point.y], { ...common, left: 0, top: 0, stroke: CANVAS_COLORS.lineStroke, strokeWidth: 1.75 });
      break;
    case 'arrow':
      object = new Line([point.x, point.y, point.x, point.y], { ...common, left: 0, top: 0, stroke: CANVAS_COLORS.accentStroke, strokeWidth: 1.75, strokeDashArray: [6, 4] });
      break;
    case 'text':
      object = new IText('Type…', { ...common, left: point.x, top: point.y, fontSize: 18, fontFamily: 'Inter', fill: themeInk('#1b1a17') });
      type = 'text';
      break;
    case 'image':
    case 'document':
      // handled by the caller (CanvasStage) — file picker / placeholder element
      return { object: null, kind, origin: point, type: 'shape' };
    default:
      object = null;
  }

  if (object) {
    canvas.add(object);
    canvas.requestRenderAll();
  }

  return { object, kind, origin: point, type };
}

export function updateDrawing(
  canvas: Canvas,
  state: DrawingState,
  point: { x: number; y: number },
  modifiers: { shift?: boolean; snapGrid?: boolean } = {},
): DrawingDimensions {
  const obj = state.object;
  const dims: DrawingDimensions = { w: 0, h: 0, label: '' };
  if (!obj) return dims;

  const { shift = false, snapGrid = false } = modifiers;

  let p = { ...point };
  if (snapGrid) {
    p = snapPointToGrid(p);
  }

  if (state.kind === 'rect' || state.kind === 'sticky') {
    let w = p.x - state.origin.x;
    let h = p.y - state.origin.y;
    if (shift) {
      // Constrain to perfect square using the larger axis
      const side = Math.max(Math.abs(w), Math.abs(h));
      w = side * Math.sign(w || 1);
      h = side * Math.sign(h || 1);
    }
    const left = w >= 0 ? state.origin.x : state.origin.x + w;
    const top = h >= 0 ? state.origin.y : state.origin.y + h;
    obj.set({ left, top, width: Math.max(1, Math.abs(w)), height: Math.max(1, Math.abs(h)) });
    dims.w = Math.abs(w);
    dims.h = Math.abs(h);
    dims.label = `${Math.round(dims.w)} × ${Math.round(dims.h)}`;
  } else if (state.kind === 'circle') {
    let dx = p.x - state.origin.x;
    let dy = p.y - state.origin.y;
    if (shift) {
      // Constrain to a circle drawn from top-left corner (bounding-box style)
      const side = Math.max(Math.abs(dx), Math.abs(dy));
      dx = side * Math.sign(dx || 1);
      dy = side * Math.sign(dy || 1);
      // Place from top-left corner so it behaves like a rect constraint
      const r = Math.max(side / 2, 1);
      const cx = state.origin.x + dx / 2;
      const cy = state.origin.y + dy / 2;
      obj.set({ radius: r, left: cx - r, top: cy - r });
      dims.w = r * 2;
      dims.h = r * 2;
      dims.label = `r ${Math.round(r)}`;
    } else {
      const r = Math.max(Math.hypot(dx, dy), 1);
      obj.set({ radius: r, left: state.origin.x - r, top: state.origin.y - r });
      dims.w = r * 2;
      dims.h = r * 2;
      dims.label = `r ${Math.round(r)}`;
    }
  } else if (state.kind === 'line' || state.kind === 'arrow') {
    let ex = p.x;
    let ey = p.y;
    if (shift) {
      // Snap to 45° increments
      const dx = p.x - state.origin.x;
      const dy = p.y - state.origin.y;
      const angle = Math.atan2(dy, dx);
      const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      ex = state.origin.x + Math.cos(snapped) * len;
      ey = state.origin.y + Math.sin(snapped) * len;
    }
    (obj as Line).set({ x1: state.origin.x, y1: state.origin.y, x2: ex, y2: ey });
    const len = Math.round(Math.hypot(ex - state.origin.x, ey - state.origin.y));
    dims.w = len;
    dims.h = 0;
    dims.label = `${len}px`;
  }

  canvas.requestRenderAll();
  return dims;
}

export function endDrawing(
  canvas: Canvas,
  state: DrawingState,
  point: { x: number; y: number },
  modifiers: { shift?: boolean; snapGrid?: boolean } = {},
): BoardElement | null {
  const obj = state.object;
  if (!obj) return null;
  updateDrawing(canvas, state, point, modifiers);
  canvas.remove(obj);

  const size =
    state.kind === 'circle'
      ? ((obj as Circle).radius ?? 0) * 2
      : state.kind === 'line' || state.kind === 'arrow'
        ? Math.hypot(
          ((obj as Line).x2 ?? 0) - ((obj as Line).x1 ?? 0),
          ((obj as Line).y2 ?? 0) - ((obj as Line).y1 ?? 0),
        )
        : (obj.width ?? 0);
  if (state.type === 'shape' && size < 3) {
    return null;
  }

  const el = serializeElement(obj);
  if (!el) return null;
  el.id = uid('el');

  // Ensure preview styling (semi-transparent) does not persist into final element
  // Drop the translucent preview fill — the final shape is solid.
  if (state.kind === 'rect') {
    el.fill = CANVAS_COLORS.nodeFill;
    el.stroke = CANVAS_COLORS.nodeStroke;
  }
  if (state.kind === 'circle') {
    el.fill = CANVAS_COLORS.nodeFill;
    el.stroke = CANVAS_COLORS.nodeStroke;
  }

  // For sticky notes, ensure proper fill color and add default text
  if (state.kind === 'sticky') {
    el.fill = CANVAS_COLORS.stickyFill;
    el.stroke = CANVAS_COLORS.stickyStroke;
    el.content = 'Write a note…';
    el.fontSize = 13;
  }

  el.kind = state.kind;
  // Don't add the temp object back - caller will materialize the BoardElement
  return el;
}

export function worldPointer(e: TPointerEventInfo<TPointerEvent>): { x: number; y: number } {
  const scene = e.scenePoint ?? e.viewportPoint;
  return { x: scene.x, y: scene.y };
}

export function centerOf(el: BoardElement): { x: number; y: number } {
  return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
}

export function removeTmpObjects(canvas: Canvas) {
  canvas.getObjects().forEach((obj) => {
    const id = elementId(obj);
    if (typeof id === 'string' && id.startsWith('tmp_')) {
      canvas.remove(obj);
    }
  });
}
