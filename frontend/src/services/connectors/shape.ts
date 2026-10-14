import { Control, FabricObject, Point, type TPointerEvent, type Transform } from 'fabric';
import type { Pt } from '../geometry';
import { isDarkTheme, themeInk } from '../ink';
import { connectorPatch, type ConnectorModel } from './model';
import { computeConnectorPath, pointAt, sceneFrom, type ConnectorPath, type Scene } from './route';
import { drawConnector, labelBox, markerSize } from './draw';

/** Which on-canvas handle is being dragged. */
export type ConnectorHandle =
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'waypoint'; index: number }
  | { kind: 'insert'; index: number }
  | { kind: 'bend' }
  | { kind: 'label' };

type EditHook = (obj: ConnectorShape, handle: ConnectorHandle, point: Pt, e: TPointerEvent) => void;

let editHook: EditHook | null = null;
/** The canvas layer implements snapping/binding for handle drags. */
export function setConnectorEditHook(hook: EditHook | null) {
  editHook = hook;
}

let sceneProvider: () => Scene = () => sceneFrom([]);
/** Supplies the current shapes (for anchoring and obstacle avoidance). */
export function setConnectorSceneProvider(fn: () => Scene) {
  sceneProvider = fn;
}
export const currentConnectorScene = () => sceneProvider();

const ACCENT = '#e8590c';

function renderHandle(style: 'end' | 'end-bound' | 'waypoint' | 'insert' | 'bend') {
  return (ctx: CanvasRenderingContext2D, left: number, top: number) => {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = ACCENT;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    switch (style) {
      case 'end':
        ctx.arc(left, top, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'end-bound':
        ctx.arc(left, top, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = ACCENT;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        break;
      case 'waypoint':
        ctx.rect(left - 4.5, top - 4.5, 9, 9);
        ctx.fill();
        ctx.stroke();
        break;
      case 'insert':
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 1.5;
        ctx.arc(left, top, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'bend':
        ctx.moveTo(left, top - 6);
        ctx.lineTo(left + 6, top);
        ctx.lineTo(left, top + 6);
        ctx.lineTo(left - 6, top);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }
    ctx.restore();
  };
}

/**
 * Fabric object for a connector. Geometry comes from the routing engine; the
 * object's box is the path's bounds, so viewport culling and hit-testing stay
 * cheap. Handles are rebuilt to match the route (endpoints, waypoints,
 * segment inserts, curve bow, label).
 */
export class ConnectorShape extends FabricObject {
  static override type = 'Connector';

  model: ConnectorModel;
  path!: ConnectorPath;
  connectorId: string;
  hovered = false;
  flowOffset = 0;
  /** World center of the bounds when the path was computed; moving the object offsets from it. */
  private geoCenter: Pt = { x: 0, y: 0 };

  constructor(model: ConnectorModel, connectorId: string, options: Partial<FabricObject> = {}) {
    super(options);
    this.model = model;
    this.connectorId = connectorId;
    this.set({
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      perPixelTargetFind: true,
      objectCaching: false,
      strokeWidth: 0,
      padding: 0,
      originX: 'left',
      originY: 'top',
    });
    this.recompute();
  }

  /** Recomputes the route (optionally with a live scene) and refits the object. */
  recompute(scene: Scene = sceneProvider(), opts: { keepControls?: boolean } = {}) {
    const path = computeConnectorPath(this.model, scene, this.connectorId);
    this.path = path;
    // Keep the model's endpoints in sync with what's drawn (persisted points).
    this.model.start.point = path.start;
    this.model.end.point = path.end;

    const pad = markerSize(this.model.strokeWidth) + this.model.strokeWidth + 10;
    let b = { x: path.bbox.x - pad, y: path.bbox.y - pad, w: path.bbox.w + pad * 2, h: path.bbox.h + pad * 2 };
    if (this.model.label) {
      const { point } = pointAt(path, this.model.labelT);
      const lb = labelBox(null, this.model.label);
      const lx = point.x - lb.w / 2 - 4;
      const ly = point.y - lb.h / 2 - 4;
      const x2 = Math.max(b.x + b.w, lx + lb.w + 8);
      const y2 = Math.max(b.y + b.h, ly + lb.h + 8);
      b = { x: Math.min(b.x, lx), y: Math.min(b.y, ly), w: 0, h: 0 };
      b.w = x2 - b.x;
      b.h = y2 - b.y;
    }
    this.set({ left: b.x, top: b.y, width: b.w, height: b.h, angle: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, flipX: false, flipY: false });
    this.geoCenter = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    // Both ends attached → the route is fully determined by its shapes.
    const pinned = !!this.model.start.elementId && !!this.model.end.elementId;
    this.lockMovementX = pinned;
    this.lockMovementY = pinned;
    this.setCoords();
    if (!opts.keepControls) this.rebuildControls();
  }

  /** World offset from moving the object (dragging a free connector, groups). */
  offset(): Pt {
    const c = new Point(0, 0).transform(this.calcTransformMatrix());
    return { x: c.x - this.geoCenter.x, y: c.y - this.geoCenter.y };
  }

  /** Model with any drag offset applied to free ends and waypoints. */
  bakedModel(): ConnectorModel {
    const d = this.offset();
    const shift = (p: Pt) => ({ x: p.x + d.x, y: p.y + d.y });
    const m: ConnectorModel = {
      ...this.model,
      start: { ...this.model.start, point: this.model.start.elementId ? this.path.start : shift(this.path.start) },
      end: { ...this.model.end, point: this.model.end.elementId ? this.path.end : shift(this.path.end) },
      waypoints: this.model.waypoints.map(shift),
    };
    return m;
  }

  toElementPatch() {
    return connectorPatch(this.bakedModel());
  }

  private rebuildControls() {
    const controls: Record<string, Control> = {};
    const toScreen = (p: Pt) => {
      const d = this.offset();
      const vpt = this.canvas?.viewportTransform ?? [1, 0, 0, 1, 0, 0];
      return new Point(p.x + d.x, p.y + d.y).transform(vpt);
    };
    const make = (key: string, handle: ConnectorHandle, at: () => Pt, style: Parameters<typeof renderHandle>[0], size = 14) => {
      controls[key] = new Control({
        cursorStyle: handle.kind === 'label' ? 'ew-resize' : 'crosshair',
        actionName: 'editConnector',
        sizeX: size,
        sizeY: size,
        positionHandler: () => toScreen(at()),
        actionHandler: (e: TPointerEvent, _t: Transform, x: number, y: number) => {
          editHook?.(this, handle, { x, y }, e);
          return true;
        },
        render: renderHandle(style),
      });
    };

    const m = this.model;
    make('start', { kind: 'start' }, () => this.path.start, m.start.elementId ? 'end-bound' : 'end');
    make('end', { kind: 'end' }, () => this.path.end, m.end.elementId ? 'end-bound' : 'end');
    m.waypoints.forEach((_, i) => make(`w${i}`, { kind: 'waypoint', index: i }, () => this.model.waypoints[i] ?? this.path.start, 'waypoint'));

    if (m.routing !== 'elbow' && !this.path.selfLoop) {
      // "+" handles halfway along each span: drag to insert a waypoint there.
      const ctrl = [this.path.start, ...m.waypoints, this.path.end];
      for (let i = 0; i < ctrl.length - 1; i++) {
        const a = ctrl[i]!;
        const b = ctrl[i + 1]!;
        if (Math.hypot(b.x - a.x, b.y - a.y) < 48) continue;
        make(`i${i}`, { kind: 'insert', index: i }, () => {
          const c = [this.path.start, ...this.model.waypoints, this.path.end];
          const p = c[i] ?? a;
          const q = c[i + 1] ?? b;
          return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        }, 'insert', 12);
      }
    }
    if (m.routing === 'curved' && !m.waypoints.length && !this.path.selfLoop) {
      make('bend', { kind: 'bend' }, () => pointAt(this.path, 0.5).point, 'bend');
    }
    if (m.label) {
      const lb = labelBox(null, m.label);
      controls.label = new Control({
        cursorStyle: 'grab',
        actionName: 'editConnector',
        sizeX: lb.w,
        sizeY: lb.h,
        positionHandler: () => toScreen(pointAt(this.path, this.model.labelT).point),
        actionHandler: (e: TPointerEvent, _t: Transform, x: number, y: number) => {
          editHook?.(this, { kind: 'label' }, { x, y }, e);
          return true;
        },
        render: () => {},
      });
    }
    this.controls = controls;
  }

  override _render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(-this.geoCenter.x, -this.geoCenter.y);
    const selected = !!this.canvas && this.canvas.getActiveObject() === this;
    drawConnector(ctx, this.path, this.model, {
      stroke: themeInk(this.model.stroke) ?? this.model.stroke,
      selected,
      hovered: this.hovered && !selected,
      flowOffset: this.flowOffset,
      dark: isDarkTheme(),
    });
    ctx.restore();
  }
}
