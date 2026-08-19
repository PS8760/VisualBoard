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
      const text = new IText(el.content || 'Write a note…', {
        left: 10,
        top: 10,
        width: el.width - 20,
        fontSize: el.fontSize ?? 13,
        fontFamily: 'Inter',
        fill: '#4a3f16',
        selectable: false,
        evented: false,
      });
      const group = new Group([bg, text], {
        ...shared,
        left: el.x,
        top: el.y,
        subTargetCheck: false,
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
      if (el.points && el.points.length >= 4) {
        const path = new Path(el.pointsToPath ? el.pointsToPath : pathFromPoints(el.points), {
          ...shared,
          stroke: el.stroke || CANVAS_COLORS.penStroke,
          strokeWidth: el.strokeWidth || 2,
          fill: null,
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
        });
        return path;
      }
      return new Rect({ ...shared, width: 1, height: 1, fill: 'transparent', stroke: 'transparent' });
    }
    case 'text':
      return new IText(el.content || 'Text', {
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
      const text = new IText(el.content || 'document.pdf', {
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
    return {
      ...common,
      content: '',
      stroke: (obj.stroke as string) ?? CANVAS_COLORS.penStroke,
      strokeWidth: obj.strokeWidth ?? 2,
      pointsToPath: obj.path ? (obj as { path: unknown }).path as unknown as string : undefined,
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

export interface DrawingState {
  object: FabricObject | null;
  kind: ElementKind;
  origin: { x: number; y: number };
  type: 'shape' | 'text' | 'comment';
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

export function updateDrawing(canvas: Canvas, state: DrawingState, point: { x: number; y: number }) {
  const obj = state.object;
  if (!obj) return;

  if (state.kind === 'rect') {
    const w = point.x - state.origin.x;
    const h = point.y - state.origin.y;
    obj.set({
      left: Math.min(state.origin.x, point.x),
      top: Math.min(state.origin.y, point.y),
      width: Math.abs(w),
      height: Math.abs(h),
    });
  } else if (state.kind === 'circle') {
    const r = Math.max(Math.hypot(point.x - state.origin.x, point.y - state.origin.y), 1);
    obj.set({ radius: r, left: state.origin.x - r, top: state.origin.y - r });
  } else if (state.kind === 'line' || state.kind === 'arrow') {
    (obj as Line).set({ x1: state.origin.x, y1: state.origin.y, x2: point.x, y2: point.y });
  }
  canvas.requestRenderAll();
}

export function endDrawing(canvas: Canvas, state: DrawingState, point: { x: number; y: number }): BoardElement | null {
  const obj = state.object;
  if (!obj) return null;
  updateDrawing(canvas, state, point);
  canvas.remove(obj);

  const size = obj.width ?? 0;
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
  el.kind = state.kind;
  obj.set({ selectable: true, evented: true });
  asVB(obj).data = { ...asVB(obj).data, id: el.id, kind: el.kind };
  canvas.add(obj);
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
