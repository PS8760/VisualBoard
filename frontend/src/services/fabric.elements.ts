import {
  Canvas,
  Rect,
  Circle,
  Line,
  IText,
  Group,
  Path,
  FabricImage,
  FabricObject,
  type FabricObjectProps,
  type TPointerEventInfo,
  type TPointerEvent,
} from 'fabric';
import type { AttachmentMeta, BoardElement, ElementKind } from '../types';
import { uid } from '../utils';

export interface VBData {
  id?: string;
  kind?: ElementKind;
  attachment?: AttachmentMeta | null;
  commentCount?: number;
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

/** Shown in a freshly created text element until the user types. */
export const TEXT_PLACEHOLDER = 'Type something…';

export const asVB = (obj: FabricObject): VBObj => obj as VBObj;

export function elementId(obj: FabricObject): string | undefined {
  return asVB(obj).data?.id;
}

export function elementKind(obj: FabricObject): ElementKind | undefined {
  return asVB(obj).data?.kind;
}

/** Custom arrow: Line subclass that renders an arrowhead at the end point. */
class ArrowLine extends Line {
  static override type = 'Arrow';
  arrowSize = 9;

  override _render(ctx: CanvasRenderingContext2D) {
    super._render(ctx);
    const p = this.calcLinePoints();
    const angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
    ctx.save();
    ctx.fillStyle = this.stroke as string;
    ctx.translate(p.x2, p.y2);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-this.arrowSize, -this.arrowSize * 0.42);
    ctx.lineTo(0, 0);
    ctx.lineTo(-this.arrowSize, this.arrowSize * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

type ArrowOptions = Partial<FabricObjectProps> & {
  left?: number;
  top?: number;
  data?: VBData;
};

function makeArrow(points: [number, number, number, number], options: ArrowOptions = {}): ArrowLine {
  return new ArrowLine(points, {
    stroke: CANVAS_COLORS.lineStroke,
    strokeWidth: 1.75,
    ...options,
  });
}

interface MaterialOptions {
  selectable?: boolean;
  evented?: boolean;
}

export function materializeElement(el: BoardElement, opts: MaterialOptions = {}): FabricObject {
  const shared = {
    left: el.x,
    top: el.y,
    angle: el.rotation,
    opacity: el.opacity ?? 1,
    selectable: opts.selectable ?? true,
    evented: opts.evented ?? true,
    data: { id: el.id, kind: el.kind, attachment: el.attachment, commentCount: el.commentCount },
  };

  switch (el.kind) {
    case 'rect':
      return new Rect({
        ...shared,
        width: el.width,
        height: el.height,
        rx: el.radius ?? 8,
        ry: el.radius ?? 8,
        fill: el.fill || CANVAS_COLORS.nodeFill,
        stroke: el.stroke || CANVAS_COLORS.nodeStroke,
        strokeWidth: el.strokeWidth || 1.5,
      });
    case 'circle':
      return new Circle({
        ...shared,
        radius: Math.min(el.width, el.height) / 2,
        fill: el.fill || CANVAS_COLORS.nodeFill,
        stroke: el.stroke || CANVAS_COLORS.nodeStroke,
        strokeWidth: el.strokeWidth || 1.5,
      });
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
      const text = new IText(el.content ?? 'Write a note…', {
        left: 10,
        top: 10,
        width: el.width - 20,
        fontSize: el.fontSize ?? 13,
        fontFamily: 'Inter',
        fill: '#4a3f16',
        selectable: false,
        evented: false,
        editable: false,
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
      return new Line((el.points ?? [el.x, el.y, el.x + el.width, el.y]) as [number, number, number, number], {
        ...shared,
        left: el.x,
        top: el.y,
        stroke: el.stroke || CANVAS_COLORS.lineStroke,
        strokeWidth: el.strokeWidth || 1.75,
      });
    case 'arrow':
      return makeArrow((el.points ?? [el.x, el.y, el.x + el.width, el.y]) as [number, number, number, number], {
        ...shared,
        left: el.x,
        top: el.y,
        stroke: el.stroke || CANVAS_COLORS.lineStroke,
        strokeWidth: el.strokeWidth || 1.75,
      });
    case 'pen': {
      const stroke = el.stroke || CANVAS_COLORS.penStroke;
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
        fill: '#1b1a17',
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
      const imgEl = new Image();
      imgEl.src = el.content;
      const img = new FabricImage(imgEl, {
        ...shared,
        left: el.x,
        top: el.y,
        width: el.width,
        height: el.height,
        objectCaching: false,
      });
      img.scaleToWidth(el.width);
      img.scaleToHeight(el.height);
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
    fill: (obj.fill as string) ?? '#fafaf8',
    stroke: (obj.stroke as string) ?? '#c2c0b5',
    strokeWidth: obj.strokeWidth ?? 1.5,
    content: '',
    attachment: data.attachment ?? null,
    commentCount: data.commentCount ?? 0,
    version: 1,
  } as BoardElement;

  if (obj instanceof Line) {
    const p = (obj as unknown as { calcLinePoints: () => { x1: number; y1: number; x2: number; y2: number } }).calcLinePoints();
    return {
      ...common,
      content: '',
      points: [p.x1, p.y1, p.x2, p.y2],
    };
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
    return { ...common, content: (obj.getElement() as HTMLImageElement).src ?? '' };
  }
  if (obj instanceof Group) {
    const textObj = obj.getObjects().find((o) => o instanceof IText) as IText | undefined;
    return { ...common, content: textObj?.text ?? '', fontSize: textObj?.fontSize };
  }
  if (obj instanceof Circle) {
    const r = obj.radius ?? 1;
    return { ...common, width: r * 2, height: r * 2, fill: obj.fill as string, stroke: obj.stroke as string };
  }
  return common;
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
  type: 'shape' | 'text' | 'comment';
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
      object = makeArrow([point.x, point.y, point.x, point.y], { ...common, left: 0, top: 0 });
      break;
    case 'text':
      object = new IText('Type…', { ...common, left: point.x, top: point.y, fontSize: 18, fontFamily: 'Inter', fill: '#1b1a17' });
      type = 'text';
      break;
    case 'comment':
      object = new Circle({ ...common, radius: 9, fill: CANVAS_COLORS.commentFill, stroke: '#ffffff', strokeWidth: 2 });
      type = 'comment';
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
  el.id = uid(state.kind === 'comment' ? 'cm' : 'el');

  // Ensure preview styling (semi-transparent) does not persist into final element
  if (state.kind === 'rect' || state.kind === 'sticky') {
    el.fill = el.fill ?? CANVAS_COLORS.nodeFill;
    el.stroke = el.stroke ?? CANVAS_COLORS.nodeStroke;
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
