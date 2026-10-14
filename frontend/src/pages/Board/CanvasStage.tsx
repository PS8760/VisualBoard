import { useEffect, useRef, useState } from 'react';
import {
  Canvas as FabricCanvas,
  FabricObject,
  Rect,
  Point,
  PencilBrush,
  ActiveSelection,
  IText,
  Group,
  cache,
  type TPointerEventInfo,
  type TPointerEvent,
} from 'fabric';
import { toast } from 'sonner';
import { useBoardStore } from '../../stores/useBoardStore';
import { useToolStore } from '../../stores/useToolStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { usePresenceStore } from '../../stores/usePresenceStore';
import { useUIStore } from '../../stores/useUIStore';
import { useThemeStore } from '../../stores/useThemeStore';
import {
  materializeElement,
  serializeElement,
  startDrawing,
  updateDrawing,
  endDrawing,
  elementId,
  elementKind,
  removeTmpObjects,
  asVB,
  renderSignature,
  worldTransform,
  isLabelled,
  ConnectorShape,
  themeInk,
  TEXT_PLACEHOLDER,
  CANVAS_COLORS,
  type DrawingState,
} from '../../services/fabric.elements';
import { animateElementIn } from '../../animations/boardAnimations';
import { throttleTrailing, uid } from '../../utils';
import { uploadDocument } from '../../api/document.api';
import { emitElementPreview, onElementPreview } from '../../services/realtime';
import { ALLOWED_UPLOAD_TYPES, imageToInlineDataUrl, validateUploadFile } from '../../services/media';
import {
  computeSnap,
  elementBox,
  recognizeStroke,
  sortByZ,
  unionBox,
  type Box,
  type Guide,
} from '../../services/geometry';
import { addLaserPoint, sendLaserPoint } from '../../services/laser';
import { connectorPatch, readConnector, type ConnectorModel, type Side } from '../../services/connectors/model';
import {
  anchorPoints,
  computeConnectorPath,
  isRedundantWaypoint,
  nearestOnPath,
  pointAt,
  resolveEnds,
  sceneFrom,
  type Scene,
} from '../../services/connectors/route';
import { setConnectorEditHook, setConnectorSceneProvider, type ConnectorHandle } from '../../services/connectors/shape';
import { snapEnd } from '../../services/connectors/snap';
import type { AttachmentMeta, BoardElement, Tool } from '../../types';
import { CanvasSkeleton } from '../../components/ui/Skeleton';
import EmptyBoard from './EmptyBoard';

/** Project-designed cursors — same pointer path as the presence overlay. */
const CURSOR = {
  arrow: "url('/cursors/arrow.svg') 5 3, default",
  arrowAccent: "url('/cursors/arrow-accent.svg') 5 3, pointer",
  crosshair: "url('/cursors/crosshair.svg') 12 12, crosshair",
  text: 'text',
  grab: 'grab',
  grabbing: 'grabbing',
  laser: "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22><circle cx=%2210%22 cy=%2210%22 r=%225%22 fill=%22%23ef4444%22 stroke=%22white%22 stroke-width=%222%22/></svg>') 10 10, crosshair",
} as const;

const SHAPE_TOOLS = new Set(['rect', 'circle', 'line', 'arrow', 'sticky', 'image', 'document', 'comment', 'pen']);
/** Tools that create content (blocked for viewers). Comments stay open to everyone. */
const CREATION_TOOLS = new Set<Tool>(['rect', 'circle', 'line', 'arrow', 'sticky', 'image', 'document', 'pen', 'text']);

function setCursorsForTool(canvas: FabricCanvas, tool: string) {
  if (SHAPE_TOOLS.has(tool)) {
    canvas.defaultCursor = CURSOR.crosshair;
    canvas.hoverCursor = CURSOR.crosshair;
    return;
  }
  if (tool === 'text') {
    canvas.defaultCursor = CURSOR.text;
    canvas.hoverCursor = CURSOR.text;
    return;
  }
  if (tool === 'hand') {
    canvas.defaultCursor = CURSOR.grab;
    canvas.hoverCursor = CURSOR.grab;
    return;
  }
  if (tool === 'laser') {
    canvas.defaultCursor = CURSOR.laser;
    canvas.hoverCursor = CURSOR.laser;
    return;
  }
  canvas.defaultCursor = CURSOR.arrow;
  canvas.hoverCursor = CURSOR.arrowAccent;
}

/** Exits editing on any IText (including sticky-note children) that is open. */
function exitEditingTexts(canvas: FabricCanvas) {
  const visit = (obj: FabricObject) => {
    if (obj instanceof IText && obj.isEditing) obj.exitEditing();
    if (obj instanceof Group) obj.getObjects().forEach(visit);
  };
  canvas.getObjects().forEach(visit);
}

/** Shapes for connector routing, memoized per element-array identity. */
let sceneCache: { elements: BoardElement[] | null; scene: Scene } = { elements: null, scene: sceneFrom([]) };
function connectorScene(): Scene {
  const elements = useBoardStore.getState().board?.elements ?? [];
  if (elements !== sceneCache.elements) sceneCache = { elements, scene: sceneFrom(elements) };
  return sceneCache.scene;
}
setConnectorSceneProvider(connectorScene);

const readOnlyNotice = () => toast.info('This board is view-only for you', { id: 'vb-readonly' });

export default function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<DrawingState | null>(null);
  const selectionBoxRef = useRef<FabricObject | null>(null);
  const selectionOriginRef = useRef<{ x: number; y: number } | null>(null);
  const panningRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const spaceDownRef = useRef(false);
  const shiftDownRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const lastClickRef = useRef<{ x: number; y: number } | null>(null);
  const editingRef = useRef<{ text: IText; host: FabricObject } | null>(null);
  const freshTextIdRef = useRef<string | null>(null);
  const suppressModifiedRef = useRef(false);
  const dimsRef = useRef<HTMLDivElement>(null);

  /* Reconciliation bookkeeping (board store → fabric objects). */
  const objectMapRef = useRef<Map<string, FabricObject>>(new Map());
  /** Element state each fabric object currently represents. */
  const syncedRef = useRef<Map<string, { ref: BoardElement; sig: string }>>(new Map());
  /** Elements whose update arrived while the user was manipulating them. */
  const deferredRef = useRef<Set<string>>(new Set());
  const interactingRef = useRef(false);
  const reconcilingRef = useRef(false);
  const suppressReconcileRef = useRef(false);
  const reconcileRef = useRef<(full?: boolean) => void>(() => {});
  /** Alignment guides drawn while moving objects (world coords). */
  const guidesRef = useRef<Guide[]>([]);
  /** Shape a connector end is about to attach to (+ snapped side) — drawn as a magnetic halo. */
  const magnetRef = useRef<{ targetId: string; side?: Side } | null>(null);
  /** Last pointer movement while inking — a still pointer at release = "hold to snap". */
  const lastInkMoveRef = useRef(0);
  const laserDownRef = useRef(false);
  const startLabelEditRef = useRef<(obj: FabricObject) => void>(() => {});
  const ensureFlowRef = useRef<() => void>(() => {});
  const [labelEdit, setLabelEdit] = useState<{
    id: string;
    box: { x: number; y: number; w: number; h: number };
    value: string;
    fontSize: number;
    color: string;
    circle: boolean;
    /** Editing a connector's mid-line label at this position along the path. */
    connectorT?: number;
  } | null>(null);

  const showDims = (label: string, x: number, y: number) => {
    const el = dimsRef.current;
    if (!el) return;
    if (el.textContent !== label) el.textContent = label;
    const transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`;
    if (el.style.transform !== transform) el.style.transform = transform;
    if (el.style.display !== 'block') el.style.display = 'block';
  };

  const hideDims = () => {
    const el = dimsRef.current;
    if (el && el.style.display !== 'none') el.style.display = 'none';
  };

  // Render only needs these; element changes are pushed to fabric imperatively.
  const empty = useBoardStore((s) => (s.board ? s.board.elements.length === 0 : false));
  const loading = useBoardStore((s) => s.loading);
  const tool = useToolStore((s) => s.tool);
  const penWidth = useToolStore((s) => s.penWidth);
  const penColor = useToolStore((s) => s.penColor);
  const penMode = useToolStore((s) => s.penMode);
  const theme = useThemeStore((s) => s.theme);

  /* ---------------------------------------------------------------------- */
  /* Local → store helpers                                                  */
  /* ---------------------------------------------------------------------- */

  /** Records that fabric already shows `el`, so reconciliation won't rebuild it. */
  const markSynced = (el: BoardElement) => {
    syncedRef.current.set(el.id, { ref: el, sig: renderSignature(el) });
  };

  /** Adds an element that the user just created (object already on canvas). */
  const commitLocalCreate = (el: BoardElement, obj: FabricObject) => {
    objectMapRef.current.set(el.id, obj);
    markSynced(el);
    useBoardStore.getState().addElement(el);
  };

  /** Pushes an edit the user made directly on a fabric object. */
  const commitLocalUpdate = (id: string, patch: Partial<BoardElement>) => {
    const current = useBoardStore.getState().board?.elements.find((el) => el.id === id);
    if (!current) return;
    markSynced({ ...current, ...patch });
    useBoardStore.getState().updateElement(id, patch);
  };

  /* ---------------------------------------------------------------------- */
  /* Tool switching                                                         */
  /* ---------------------------------------------------------------------- */

  const activeToolRef = useRef<typeof tool>('select');
  useEffect(() => {
    const canvas = useCanvasStore.getState().canvas;
    if (!canvas) return;

    const toolChanged = activeToolRef.current !== tool;

    // Cancel an in-progress drawing gesture when the tool changes so the
    // temporary object can never leak into another tool's state.
    if (toolChanged && drawingRef.current) {
      if (drawingRef.current.object) canvas.remove(drawingRef.current.object);
      drawingRef.current = null;
      hideDims();
    }
    // Don't leave a text editor open behind a different tool.
    if (toolChanged) exitEditingTexts(canvas);
    activeToolRef.current = tool;

    const canEdit = useBoardStore.getState().canEdit;
    const isPen = tool === 'pen' && canEdit;

    canvas.isDrawingMode = isPen;
    if (isPen) {
      const brush = new PencilBrush(canvas);
      const highlighter = penMode === 'highlighter';
      brush.width = highlighter ? penWidth * 4 : penWidth;
      const liveColor = themeInk(penColor) ?? penColor;
      brush.color = highlighter ? `${liveColor}59` : liveColor;
      // Drop jittery sub-pixel points for smoother ink.
      brush.decimate = 2.5;
      canvas.freeDrawingBrush = brush;
      canvas.selection = false;
      canvas.skipTargetFind = false;
      canvas.freeDrawingCursor = CURSOR.crosshair;
      setCursorsForTool(canvas, tool);
    } else if (tool === 'hand' || tool === 'laser') {
      canvas.selection = false;
      canvas.skipTargetFind = true;
      setCursorsForTool(canvas, tool);
      if (canvas.getActiveObjects().length) {
        canvas.discardActiveObject();
        useBoardStore.getState().clearSelection();
        canvas.requestRenderAll();
      }
    } else {
      canvas.selection = tool === 'select' && canEdit;
      // Creation tools must never grab the object under the pointer — starting
      // a shape or connector on top of another element used to drag it.
      canvas.skipTargetFind = tool !== 'select';
      setCursorsForTool(canvas, tool);
      if (tool !== 'select' && canvas.getActiveObjects().length) {
        canvas.discardActiveObject();
        useBoardStore.getState().clearSelection();
        canvas.requestRenderAll();
      }
    }
  }, [tool, penWidth, penColor, penMode, theme]);

  const shouldPan = (e: MouseEvent) => {
    const current = useToolStore.getState().tool;
    return current === 'hand' || spaceDownRef.current || e.button === 1;
  };

  function setupInteractions(canvas: FabricCanvas, host: HTMLDivElement) {
    const store = useCanvasStore.getState();

    /* -------------------------------------------------------------- */
    /* Reconciliation                                                  */
    /* -------------------------------------------------------------- */

    const isBusy = (obj: FabricObject) => {
      const editing = editingRef.current;
      if (editing && editing.host === obj && editing.text.isEditing) return true;
      const active = canvas.getActiveObjects();
      if (!active.includes(obj)) return false;
      return interactingRef.current || canvas.getActiveObject() instanceof ActiveSelection;
    };

    const buildObject = (el: BoardElement) => {
      const canEdit = useBoardStore.getState().canEdit;
      const obj = materializeElement(el, { selectable: canEdit });
      objectMapRef.current.set(el.id, obj);
      markSynced(el);
      return obj;
    };

    const removeObject = (id: string, obj: FabricObject) => {
      const editing = editingRef.current;
      if (editing?.host === obj && editing.text.isEditing) editing.text.exitEditing();
      if (canvas.getActiveObjects().includes(obj)) canvas.discardActiveObject();
      canvas.remove(obj);
      objectMapRef.current.delete(id);
      syncedRef.current.delete(id);
      deferredRef.current.delete(id);
    };

    /**
     * Brings fabric in line with the board store, touching only what changed.
     * `full` rebuilds everything (board switch, version restore).
     */
    const reconcile = (full = false) => {
      const board = useBoardStore.getState().board;
      if (!board || suppressReconcileRef.current) return;
      if (reconcilingRef.current) {
        queueMicrotask(() => reconcileRef.current(full));
        return;
      }
      reconcilingRef.current = true;
      try {
        if (full) {
          removeTmpObjects(canvas);
          exitEditingTexts(canvas);
          canvas.discardActiveObject();
          canvas.remove(...canvas.getObjects());
          objectMapRef.current.clear();
          syncedRef.current.clear();
          deferredRef.current.clear();
        }

        const ordered = sortByZ(board.elements);
        const seen = new Set<string>();
        // Shapes whose geometry changed this pass — connectors near them re-route.
        const changedShapes = new Set<string>();
        const changedBoxes: Box[] = [];
        const rebuilt = new Set<string>();
        const noteShape = (el: BoardElement, before?: BoardElement) => {
          if (el.kind === 'line' || el.kind === 'arrow') return;
          const a = elementBox(el);
          if (before) {
            const b = elementBox(before);
            if (a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h) return;
            changedBoxes.push(b);
          }
          changedShapes.add(el.id);
          changedBoxes.push(a);
        };
        for (const el of ordered) {
          seen.add(el.id);
          const obj = objectMapRef.current.get(el.id);
          if (!obj) {
            canvas.add(buildObject(el));
            rebuilt.add(el.id);
            if (!full) noteShape(el);
            continue;
          }
          const synced = syncedRef.current.get(el.id);
          if (synced?.ref === el) continue;
          const sig = renderSignature(el);
          if (synced?.sig === sig) {
            syncedRef.current.set(el.id, { ref: el, sig });
            deferredRef.current.delete(el.id);
            continue;
          }
          if (isBusy(obj)) {
            deferredRef.current.add(el.id);
            continue;
          }
          const wasActive = canvas.getActiveObject() === obj;
          const index = canvas.getObjects().indexOf(obj);
          noteShape(el, synced?.ref);
          rebuilt.add(el.id);
          const next = buildObject(el);
          canvas.remove(obj);
          canvas.insertAt(Math.max(0, index), next);
          deferredRef.current.delete(el.id);
          if (wasActive) canvas.setActiveObject(next);
        }

        for (const [id, obj] of [...objectMapRef.current]) {
          if (!seen.has(id)) {
            const gone = syncedRef.current.get(id)?.ref;
            if (gone) noteShape(gone);
            removeObject(id, obj);
          }
        }
        // Re-route connectors attached to changed shapes, and orthogonal
        // routes whose corridor they touch (obstacle avoidance).
        if (changedBoxes.length) {
          const region = unionBox(changedBoxes)!;
          const near = { x: region.x - 340, y: region.y - 340, w: region.w + 680, h: region.h + 680 };
          for (const obj of canvas.getObjects()) {
            if (!(obj instanceof ConnectorShape) || rebuilt.has(obj.connectorId)) continue;
            const m = obj.model;
            const attached = (m.start.elementId && changedShapes.has(m.start.elementId)) || (m.end.elementId && changedShapes.has(m.end.elementId));
            const b = obj.path.bbox;
            const crosses = m.routing === 'elbow' && b.x < near.x + near.w && b.x + b.w > near.x && b.y < near.y + near.h && b.y + b.h > near.y;
            if (attached || crosses) obj.recompute(connectorScene(), { keepControls: isBusy(obj) });
          }
        }
        ensureFlowRef.current();
        // Stacking order follows zIndex (then creation order).
        const objects = canvas.getObjects();
        ordered.forEach((el, i) => {
          const obj = objectMapRef.current.get(el.id);
          if (obj && objects[i] !== obj) canvas.moveObjectTo(obj, i);
        });
        canvas.requestRenderAll();
      } finally {
        reconcilingRef.current = false;
      }
    };
    reconcileRef.current = reconcile;

    /** Re-run for elements that changed while the user held them. */
    const flushDeferred = () => {
      if (deferredRef.current.size) reconcile();
    };

    /* -------------------------------------------------------------- */
    /* Live transform previews                                         */
    /* -------------------------------------------------------------- */

    const sendPreview = throttleTrailing((end: boolean) => {
      for (const obj of canvas.getActiveObjects()) {
        const id = elementId(obj);
        if (!id) continue;
        const t = worldTransform(obj);
        emitElementPreview({ id, x: t.cx, y: t.cy, rotation: t.angle, scaleX: t.scaleX, scaleY: t.scaleY, end });
      }
    }, 50);
    /** Connectors follow shapes live while they're dragged (persisted by the maintenance pass). */
    const routeLiveConnectors = () => {
      const board = useBoardStore.getState().board;
      if (!board) return;
      const active = canvas.getActiveObjects();
      const movedIds = new Set(active.map((o) => elementId(o)).filter(Boolean) as string[]);
      const overrides = new Map<string, Box>();
      for (const obj of active) {
        const id = elementId(obj);
        if (!id || obj instanceof ConnectorShape) continue;
        const b = obj.getBoundingRect();
        overrides.set(id, { x: b.left, y: b.top, w: b.width, h: b.height });
      }
      if (!overrides.size) return;
      const scene = sceneFrom(board.elements, overrides);
      for (const obj of canvas.getObjects()) {
        if (!(obj instanceof ConnectorShape) || movedIds.has(obj.connectorId)) continue;
        const { start, end } = obj.model;
        if ((start.elementId && overrides.has(start.elementId)) || (end.elementId && overrides.has(end.elementId))) {
          obj.recompute(scene, { keepControls: true });
        }
      }
    };

    const onTransforming = (opt: { e?: Event; transform?: { action?: string } }) => {
      useCanvasStore.getState().setInteracting(true);
      sendPreview(false);
      const active = canvas.getActiveObject();
      // Smart guides on move (hold Alt to place freely).
      if (active && opt.transform?.action === 'drag' && !(opt.e as MouseEvent | undefined)?.altKey) {
        const box = active.getBoundingRect();
        const activeSet = new Set(canvas.getActiveObjects());
        const others = canvas
          .getObjects()
          .filter((o) => o !== active && !activeSet.has(o) && elementId(o) && o.visible && o.isOnScreen())
          .slice(0, 400)
          .map((o) => {
            const b = o.getBoundingRect();
            return { x: b.left, y: b.top, w: b.width, h: b.height };
          });
        const snap = computeSnap({ x: box.left, y: box.top, w: box.width, h: box.height }, others, 6 / canvas.getZoom());
        if (snap.dx || snap.dy) {
          active.set({ left: (active.left ?? 0) + snap.dx, top: (active.top ?? 0) + snap.dy });
          active.setCoords();
        }
        guidesRef.current = snap.guides;
      } else {
        guidesRef.current = [];
      }
      routeLiveConnectors();
    };

    /** Draws alignment guides and magnetic connector feedback above the scene. */
    const onAfterRender = (opt: { ctx: CanvasRenderingContext2D }) => {
      const guides = guidesRef.current;
      const magnet = magnetRef.current;
      if (!guides.length && !magnet) return;
      const ctx = opt.ctx;
      const vpt = canvas.viewportTransform;
      const zoom = canvas.getZoom();
      ctx.save();
      ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);
      ctx.strokeStyle = '#e8590c';
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([4 / zoom, 3 / zoom]);
      for (const g of guides) {
        ctx.beginPath();
        if (g.axis === 'x') {
          ctx.moveTo(g.at, g.from);
          ctx.lineTo(g.at, g.to);
        } else {
          ctx.moveTo(g.from, g.at);
          ctx.lineTo(g.to, g.at);
        }
        ctx.stroke();
      }
      const shape = magnet ? connectorScene().shape(magnet.targetId) : undefined;
      if (magnet && shape) {
        // Perimeter halo …
        const b = shape.box;
        const pad = 6 / zoom;
        ctx.setLineDash([]);
        ctx.lineWidth = 2 / zoom;
        ctx.strokeStyle = 'rgba(232, 89, 12, 0.85)';
        ctx.fillStyle = 'rgba(232, 89, 12, 0.07)';
        ctx.beginPath();
        if (shape.kind === 'circle') {
          ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) / 2 + pad, 0, Math.PI * 2);
        } else {
          ctx.roundRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2, 10 / zoom);
        }
        ctx.fill();
        ctx.stroke();
        // … and anchor dots; the snapped one is filled.
        for (const a of anchorPoints(shape)) {
          const on = magnet.side === a.side;
          ctx.beginPath();
          ctx.arc(a.point.x, a.point.y, (on ? 6 : 4.5) / zoom, 0, Math.PI * 2);
          ctx.fillStyle = on ? '#e8590c' : '#ffffff';
          ctx.fill();
          ctx.lineWidth = 1.5 / zoom;
          ctx.strokeStyle = '#e8590c';
          ctx.stroke();
        }
      }
      ctx.restore();
    };

    // Handle drags on connectors: endpoint snapping, waypoints, bow, label slide.
    let insertedAt = -1;
    setConnectorEditHook((obj, handle: ConnectorHandle, p, e) => {
      useCanvasStore.getState().setInteracting(true);
      interactingRef.current = true;
      const m = obj.model;
      const scene = connectorScene();
      switch (handle.kind) {
        case 'start':
        case 'end': {
          const elements = sortByZ(useBoardStore.getState().board?.elements ?? []);
          const snap = snapEnd(p, elements, scene, { zoom: canvas.getZoom(), exclude: obj.connectorId, disabled: (e as MouseEvent).altKey });
          magnetRef.current = snap.elementId ? { targetId: snap.elementId, side: snap.side } : null;
          m[handle.kind] = { elementId: snap.elementId, anchor: snap.anchor, point: snap.point };
          break;
        }
        case 'waypoint':
          m.waypoints[handle.index] = p;
          break;
        case 'insert':
          if (insertedAt < 0) {
            m.waypoints.splice(handle.index, 0, p);
            insertedAt = handle.index;
          } else {
            m.waypoints[insertedAt] = p;
          }
          break;
        case 'bend': {
          // Bow so the curve's midpoint follows the pointer.
          const flat = computeConnectorPath({ ...m, bend: 0 }, scene, obj.connectorId);
          const mid = pointAt(flat, 0.5).point;
          const chord = { x: flat.end.x - flat.start.x, y: flat.end.y - flat.start.y };
          const l = Math.hypot(chord.x, chord.y) || 1;
          m.bend = ((p.x - mid.x) * -chord.y + (p.y - mid.y) * chord.x) / l;
          break;
        }
        case 'label':
          m.labelT = Math.min(0.95, Math.max(0.05, nearestOnPath(obj.path, p).t));
          break;
      }
      obj.recompute(scene, { keepControls: true });
      canvas.requestRenderAll();
    });
    const resetConnectorDrag = () => {
      insertedAt = -1;
    };

    const previewTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const detachPreview = onElementPreview((p) => {
      const obj = objectMapRef.current.get(p.id);
      if (!obj || isBusy(obj)) return;
      obj.set({ angle: p.rotation ?? obj.angle, scaleX: p.scaleX ?? obj.scaleX, scaleY: p.scaleY ?? obj.scaleY });
      obj.setPositionByOrigin(new Point(p.x, p.y), 'center', 'center');
      obj.setCoords();
      canvas.requestRenderAll();
      // If the authoritative update never follows (rejected / dropped),
      // snap back to the stored state instead of keeping a ghost position.
      clearTimeout(previewTimers.get(p.id));
      previewTimers.set(
        p.id,
        setTimeout(() => {
          previewTimers.delete(p.id);
          const current = objectMapRef.current.get(p.id);
          if (current === obj && !isBusy(obj)) {
            syncedRef.current.delete(p.id);
            objectMapRef.current.delete(p.id);
            canvas.remove(obj);
            reconcile();
          }
        }, p.end ? 2_500 : 5_000),
      );
    });
    // A real update for a previewed element supersedes the snap-back timer.
    const unsubscribePreviewTimers = useBoardStore.subscribe((s, prev) => {
      if (!previewTimers.size || s.board?.elements === prev.board?.elements) return;
      for (const [id, timer] of previewTimers) {
        const el = s.board?.elements.find((e) => e.id === id);
        const before = prev.board?.elements.find((e) => e.id === id);
        if (el !== before) {
          clearTimeout(timer);
          previewTimers.delete(id);
        }
      }
    });

    /* -------------------------------------------------------------- */
    /* Viewport                                                        */
    /* -------------------------------------------------------------- */

    const broadcastCursor = (opt: TPointerEventInfo<TPointerEvent>) => {
      // scenePoint is already in world coordinates — converting it again
      // misplaced remote cursors whenever the view was panned or zoomed.
      const world = opt.scenePoint;
      if (!world) return;
      usePresenceStore.getState().updateLocalCursor(world.x, world.y, useToolStore.getState().tool);
    };

    const onWheel = (opt: TPointerEventInfo<TPointerEvent>) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();
      stopInertia();
      store.cancelAnimation();
      useUIStore.getState().setFollowing(null);

      const rect = host.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch arrives as ctrl+wheel with fine-grained deltas.
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.003));
        store.zoomBy(factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else if (e.shiftKey) {
        store.panBy(-e.deltaY, 0);
      } else {
        store.panBy(-e.deltaX, -e.deltaY);
      }
    };

    // Two-finger touch: pinch to zoom around the midpoint, drag to pan.
    let pinch: { dist: number; mx: number; my: number } | null = null;
    const touchInfo = (e: TouchEvent) => {
      const rect = host.getBoundingClientRect();
      const [a, b] = [e.touches[0]!, e.touches[1]!];
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
        mx: (a.clientX + b.clientX) / 2 - rect.left,
        my: (a.clientY + b.clientY) / 2 - rect.top,
      };
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      if (drawingRef.current?.object) canvas.remove(drawingRef.current.object);
      drawingRef.current = null;
      pinch = touchInfo(e);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      e.stopPropagation();
      const next = touchInfo(e);
      if (pinch.dist > 0) store.zoomBy(next.dist / pinch.dist, { x: next.mx, y: next.my });
      store.panBy(next.mx - pinch.mx, next.my - pinch.my);
      pinch = next;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null;
    };

    /* -------------------------------------------------------------- */
    /* Pointer                                                         */
    /* -------------------------------------------------------------- */

    // Hand-pan inertia: release with momentum, decays smoothly.
    let panSamples: Array<{ x: number; y: number; t: number }> = [];
    let inertiaFrame: number | null = null;
    const stopInertia = () => {
      if (inertiaFrame !== null) cancelAnimationFrame(inertiaFrame);
      inertiaFrame = null;
    };
    const startInertia = () => {
      const recent = panSamples.filter((p) => performance.now() - p.t < 80);
      panSamples = [];
      if (recent.length < 2) return;
      const a = recent[0]!;
      const b = recent[recent.length - 1]!;
      const dt = Math.max(1, b.t - a.t);
      let vx = (b.x - a.x) / dt;
      let vy = (b.y - a.y) / dt;
      if (Math.hypot(vx, vy) < 0.25) return;
      let last = performance.now();
      const step = (now: number) => {
        const elapsed = now - last;
        last = now;
        const decay = Math.pow(0.94, elapsed / 16);
        vx *= decay;
        vy *= decay;
        store.panBy(vx * elapsed, vy * elapsed);
        inertiaFrame = Math.hypot(vx, vy) > 0.02 ? requestAnimationFrame(step) : null;
      };
      inertiaFrame = requestAnimationFrame(step);
    };

    let lastLaserSentAt = 0;
    const selfLaserId = 'self';
    const laserAt = (p: { x: number; y: number }, start: boolean) => {
      const me = usePresenceStore.getState().users.find((u) => u.isLocal);
      addLaserPoint(selfLaserId, me?.color ?? '#ef4444', p, undefined, start);
      const now = performance.now();
      if (start || now - lastLaserSentAt > 16) {
        lastLaserSentAt = now;
        sendLaserPoint({ x: p.x, y: p.y, ...(start ? { start: true } : {}) });
      }
    };

    const onMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      stopInertia();
      store.cancelAnimation();
      useUIStore.getState().setFollowing(null);
      const e = opt.e as MouseEvent;
      const pointer = opt.scenePoint;
      const activeTool = useToolStore.getState().tool;
      const canEdit = useBoardStore.getState().canEdit;
      interactingRef.current = !!opt.target;

      // Clicks outside the host being edited end text editing first
      // (sticky children are never the active object, so fabric won't do it).
      const editing = editingRef.current;
      if (editing && editing.text.isEditing) {
        const sameHost = opt.target === editing.host || opt.target === editing.text;
        if (sameHost) {
          const ta = (editing.text as unknown as { hiddenTextarea?: HTMLTextAreaElement | null }).hiddenTextarea;
          ta?.focus();
        } else {
          editing.text.exitEditing();
        }
      }

      lastClickRef.current = { x: pointer.x, y: pointer.y };

      if (activeTool === 'laser' && !shouldPan(e)) {
        interactingRef.current = false;
        laserDownRef.current = true;
        laserAt(pointer, true);
        return;
      }

      if (shouldPan(e)) {
        interactingRef.current = false;
        panSamples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
        panningRef.current = { lastX: e.clientX, lastY: e.clientY };
        canvas.selection = false;
        canvas.defaultCursor = CURSOR.grabbing;
        canvas.hoverCursor = CURSOR.grabbing;
        if (canvas.getActiveObject()) {
          canvas.discardActiveObject();
          useBoardStore.getState().clearSelection();
        }
        canvas.requestRenderAll();
        return;
      }

      if (CREATION_TOOLS.has(activeTool) && !canEdit) {
        readOnlyNotice();
        useToolStore.getState().setTool('select');
        return;
      }

      if (activeTool === 'comment') {
        // Threads anchor to the element under the pointer, else to the exact
        // world point — both survive pan/zoom because they are world-space.
        const hit = findObjectAt(canvas, pointer.x, pointer.y);
        const targetId = hit ? elementId(hit) : undefined;
        useUIStore.getState().setActiveComment({ elementId: targetId, x: pointer.x, y: pointer.y });
        useToolStore.getState().setTool('select');
        return;
      }
      if (activeTool === 'image') {
        fileInputRef.current?.click();
        return;
      }
      if (activeTool === 'document') {
        docInputRef.current?.click();
        return;
      }

      // Pen strokes are driven entirely by fabric's free-drawing brush.
      if (activeTool === 'pen') return;

      if (activeTool === 'select') {
        const hit = findObjectAt(canvas, pointer.x, pointer.y);
        if (!hit && canEdit) {
          selectionOriginRef.current = { x: pointer.x, y: pointer.y };
          const rect = new Rect({
            left: pointer.x,
            top: pointer.y,
            width: 0,
            height: 0,
            fill: 'rgba(217, 72, 15, 0.08)',
            stroke: 'rgba(217, 72, 15, 0.45)',
            strokeWidth: 1,
            strokeDashArray: [4, 4],
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          selectionBoxRef.current = rect;
          canvas.add(rect);
          canvas.requestRenderAll();
        }
        return;
      }

      const drawing = startDrawing(canvas, activeTool as DrawingState['kind'], pointer);

      if (drawing.type === 'text' && drawing.object) {
        drawingRef.current = null;
        canvas.remove(drawing.object);
        const el: BoardElement = {
          id: uid('el'),
          kind: 'text',
          x: drawing.object.left ?? pointer.x,
          y: drawing.object.top ?? pointer.y,
          width: 200,
          height: 32,
          rotation: 0,
          fill: 'transparent',
          stroke: 'transparent',
          strokeWidth: 0,
          fontSize: 18,
          content: TEXT_PLACEHOLDER,
          version: 0,
        };
        const obj = materializeElement(el);
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        // Register before entering editing so history captures the
        // placeholder state as the undo point for this new element.
        commitLocalCreate(el, obj);
        freshTextIdRef.current = el.id;
        if (obj instanceof IText) {
          obj.enterEditing();
          obj.selectAll();
        }
        useToolStore.getState().setTool('select');
      } else if (drawing.type === 'shape' && drawing.object) {
        drawingRef.current = drawing;
      }
    };

    const onMouseMove = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (panningRef.current) {
        const { lastX, lastY } = panningRef.current;
        const e = opt.e as MouseEvent;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        panningRef.current = { lastX: e.clientX, lastY: e.clientY };
        panSamples.push({ x: e.clientX, y: e.clientY, t: performance.now() });
        if (panSamples.length > 8) panSamples.shift();
        store.panBy(dx, dy);
        return;
      }
      if (laserDownRef.current) {
        laserAt(opt.scenePoint, false);
        broadcastCursor(opt);
        return;
      }
      if (selectionBoxRef.current && selectionOriginRef.current) {
        const { x: origX, y: origY } = selectionOriginRef.current;
        const { x: curX, y: curY } = opt.scenePoint;
        selectionBoxRef.current.set({
          left: Math.min(origX, curX),
          top: Math.min(origY, curY),
          width: Math.max(1, Math.abs(curX - origX)),
          height: Math.max(1, Math.abs(curY - origY)),
        });
        canvas.requestRenderAll();
      } else if (drawingRef.current) {
        if (drawingRef.current.kind === 'arrow' || drawingRef.current.kind === 'line') {
          const elements = sortByZ(useBoardStore.getState().board?.elements ?? []);
          const snap = snapEnd(opt.scenePoint, elements, connectorScene(), { zoom: canvas.getZoom(), disabled: (opt.e as MouseEvent).altKey });
          magnetRef.current = snap.elementId ? { targetId: snap.elementId, side: snap.side } : null;
        }
        const gridVisible = useCanvasStore.getState().gridVisible;
        const dims = updateDrawing(canvas, drawingRef.current, opt.scenePoint, {
          shift: shiftDownRef.current,
          snapGrid: gridVisible,
        });
        // Dimension chip follows the cursor via direct DOM writes so
        // mousemove never triggers a React re-render.
        if (dims.label) {
          const e = opt.e as MouseEvent;
          const rect = host.getBoundingClientRect();
          showDims(dims.label, e.clientX - rect.left, e.clientY - rect.top - 30);
        } else {
          hideDims();
        }
      } else {
        hideDims();
      }
      broadcastCursor(opt);
    };

    const onMouseUp = (opt: TPointerEventInfo<TPointerEvent>) => {
      hideDims();
      interactingRef.current = false;
      laserDownRef.current = false;
      useCanvasStore.getState().setInteracting(false);
      resetConnectorDrag();
      if (guidesRef.current.length || magnetRef.current) {
        guidesRef.current = [];
        magnetRef.current = null;
        canvas.requestRenderAll();
      }
      const activeTool = useToolStore.getState().tool;
      if (panningRef.current) {
        panningRef.current = null;
        startInertia();
        canvas.selection = activeTool === 'select' && useBoardStore.getState().canEdit;
        canvas.skipTargetFind = activeTool !== 'select';
        setCursorsForTool(canvas, activeTool);
        canvas.requestRenderAll();
        return;
      }
      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current;
        const bounds = box.getBoundingRect();
        canvas.remove(box);
        selectionBoxRef.current = null;
        selectionOriginRef.current = null;

        const selectedObjects: FabricObject[] = [];
        const ids: string[] = [];
        for (const obj of canvas.getObjects()) {
          if (!obj.visible || obj.excludeFromExport || !obj.selectable) continue;
          const b = obj.getBoundingRect();
          if (
            b.left < bounds.left + bounds.width &&
            b.left + b.width > bounds.left &&
            b.top < bounds.top + bounds.height &&
            b.top + b.height > bounds.top
          ) {
            const id = elementId(obj);
            if (id) {
              ids.push(id);
              selectedObjects.push(obj);
            }
          }
        }

        if (selectedObjects.length > 1) {
          canvas.setActiveObject(new ActiveSelection(selectedObjects, { canvas }));
        } else if (selectedObjects.length === 1) {
          canvas.setActiveObject(selectedObjects[0]!);
        } else {
          canvas.discardActiveObject();
        }
        useBoardStore.getState().select(ids);
        canvas.requestRenderAll();
        flushDeferred();
        return;
      }

      if (drawingRef.current) {
        const gridVisible = useCanvasStore.getState().gridVisible;
        const el = endDrawing(canvas, drawingRef.current, opt.scenePoint, {
          shift: shiftDownRef.current,
          snapGrid: gridVisible,
        });
        drawingRef.current = null;
        if (el && (el.kind === 'line' || el.kind === 'arrow') && el.points) {
          // Snap both ends magnetically; choose the routing (auto: elbow
          // between two shapes, straight otherwise) and route it.
          const elements = sortByZ(useBoardStore.getState().board?.elements ?? []);
          const scene = connectorScene();
          const alt = (opt.e as MouseEvent).altKey;
          const [x1, y1, x2, y2] = el.points as [number, number, number, number];
          const zoom = canvas.getZoom();
          const s0 = snapEnd({ x: x1, y: y1 }, elements, scene, { zoom, disabled: alt });
          const e0 = snapEnd({ x: x2, y: y2 }, elements, scene, { zoom, disabled: alt });
          const pref = useToolStore.getState().connectorRouting;
          // The drag preview is an accent dashed line; the connector itself
          // uses the regular connector style.
          el.stroke = CANVAS_COLORS.lineStroke;
          el.strokeWidth = 1.75;
          el.strokeStyle = undefined;
          const model: ConnectorModel = {
            ...readConnector(el),
            routing: pref === 'auto' ? (s0.elementId && e0.elementId ? 'elbow' : 'straight') : pref,
            start: { elementId: s0.elementId, anchor: s0.anchor, point: s0.point },
            end: { elementId: e0.elementId, anchor: e0.anchor, point: e0.point },
          };
          const path = computeConnectorPath(model, scene, el.id);
          model.start.point = path.start;
          model.end.point = path.end;
          Object.assign(el, connectorPatch(model));
        }
        magnetRef.current = null;
        if (el) {
          // endDrawing already removed the temp object; materialize the final element.
          const finalObj = materializeElement(el);
          canvas.add(finalObj);
          animateElementIn(finalObj);
          canvas.setActiveObject(finalObj);
          canvas.requestRenderAll();
          commitLocalCreate(el, finalObj);
          useBoardStore.getState().select([el.id]);
          useToolStore.getState().setTool('select');
        }
      }
      flushDeferred();
    };

    const onPathCreated = (opt: { path?: FabricObject }) => {
      if (!opt.path) return;
      // The raw fabric path has no app data, so stamp a stable id + kind
      // before serializing. Without this the stroke is never registered in
      // board state and never persisted.
      asVB(opt.path).data = { id: uid('el'), kind: 'pen' };
      const el = serializeElement(opt.path);
      if (!el) return;
      const { penColor, penWidth, penMode, autoShape } = useToolStore.getState();
      const highlighter = penMode === 'highlighter';
      el.stroke = penColor;
      el.strokeWidth = highlighter ? penWidth * 4 : penWidth;
      if (highlighter) el.opacity = 0.35;
      canvas.remove(opt.path);

      // QuickShape: holding still before releasing (or auto-shape mode)
      // turns a recognizable stroke into a clean line / circle / rectangle.
      const held = performance.now() - lastInkMoveRef.current > 450;
      const shape = !highlighter && (held || autoShape) && el.points ? recognizeStroke(el.points) : null;
      if (shape) {
        const base = {
          id: uid('el'),
          rotation: 0,
          fill: 'transparent',
          stroke: penColor,
          strokeWidth: Math.max(1.5, penWidth),
          content: '',
          version: 0,
        };
        const clean: BoardElement =
          shape.kind === 'line'
            ? {
                ...base,
                kind: 'line',
                x: Math.min(shape.points[0], shape.points[2]),
                y: Math.min(shape.points[1], shape.points[3]),
                width: Math.abs(shape.points[2] - shape.points[0]),
                height: Math.abs(shape.points[3] - shape.points[1]),
                points: shape.points,
                pointsAbsolute: true,
              }
            : { ...base, kind: shape.kind, x: shape.box.x, y: shape.box.y, width: shape.box.w, height: shape.box.h, radius: 6 };
        const obj = materializeElement(clean);
        canvas.add(obj);
        animateElementIn(obj);
        commitLocalCreate(clean, obj);
        toast(`Snapped to ${shape.kind === 'rect' ? 'rectangle' : shape.kind}`, {
          id: 'vb-quickshape',
          duration: 2500,
          action: { label: 'Undo', onClick: () => useBoardStore.getState().undo() },
        });
        return;
      }

      const obj = materializeElement(el);
      canvas.add(obj);
      animateElementIn(obj);
      commitLocalCreate(el, obj);
    };

    const onEditLabelRequest = () => {
      const active = canvas.getActiveObject();
      if (active) startLabelEditRef.current(active);
    };
    window.addEventListener('vb:edit-label', onEditLabelRequest);

    const startConnectorLabelEdit = (obj: ConnectorShape, t: number) => {
      const { point } = pointAt(obj.path, t);
      setLabelEdit({
        id: obj.connectorId,
        box: { x: point.x - 100, y: point.y - 16, w: 200, h: 32 },
        value: obj.model.label,
        fontSize: 12,
        color: themeInk('#1b1a17') ?? '#1b1a17',
        circle: false,
        connectorT: t,
      });
    };

    startLabelEditRef.current = (obj: FabricObject) => {
      if (obj instanceof ConnectorShape) {
        startConnectorLabelEdit(obj, obj.model.labelT);
        return;
      }
      const id = elementId(obj);
      if (!id || !isLabelled(obj)) return;
      const b = obj.getBoundingRect();
      obj.labelHidden = true;
      obj.set('dirty', true);
      canvas.requestRenderAll();
      setLabelEdit({
        id,
        box: { x: b.left, y: b.top, w: b.width, h: b.height },
        value: obj.label,
        fontSize: obj.labelSize,
        color: obj.labelColor,
        circle: elementKind(obj) === 'circle',
      });
    };

    const onSelection = () => {
      const ids = canvas.getActiveObjects().map((o) => elementId(o)).filter(Boolean) as string[];
      useBoardStore.getState().select(ids);
    };

    const onSelectionCleared = () => {
      useBoardStore.getState().select([]);
      if (!suppressReconcileRef.current) flushDeferred();
    };

    const onObjectModified = () => {
      // Exiting text editing fires a synthetic object:modified — the
      // pre-edit history point was already captured on editing:entered.
      if (suppressModifiedRef.current) {
        suppressModifiedRef.current = false;
        return;
      }
      const active = canvas.getActiveObject();
      if (!active) return;
      sendPreview(true);

      const isMulti = active instanceof ActiveSelection;
      const objects = isMulti ? active.getObjects() : [active];
      const { commitHistory } = useBoardStore.getState();

      suppressReconcileRef.current = true;
      try {
        // Members of an ActiveSelection store coordinates relative to the
        // selection; dissolving it restores absolute canvas coordinates.
        // (Serializing them in place persisted positions near the origin.)
        if (isMulti) canvas.discardActiveObject();
        commitHistory();
        for (const obj of objects) {
          const el = serializeElement(obj);
          const id = elementId(obj);
          if (!el || !id) continue;
          const { x, y, width, height, rotation, scaleX, scaleY, points, pointsToPath, pointsAbsolute } = el;
          const patch: Partial<BoardElement> = {
            x,
            y,
            width,
            height,
            rotation,
            scaleX,
            scaleY,
            ...(points ? { points } : {}),
            ...(pointsToPath ? { pointsToPath } : {}),
            ...(pointsAbsolute ? { pointsAbsolute } : {}),
          };
          if (obj instanceof ConnectorShape) {
            // Waypoints dragged back into line with their neighbours disappear.
            const model = obj.bakedModel();
            if (model.routing === 'straight' && model.waypoints.length) {
              const pts = [model.start.point, ...model.waypoints, model.end.point];
              model.waypoints = model.waypoints.filter((w, i) => !isRedundantWaypoint(pts[i]!, w, pts[i + 2]!));
            }
            commitLocalUpdate(id, connectorPatch(model));
            continue;
          }
          commitLocalUpdate(id, patch);
        }
        commitHistory();
        if (isMulti) canvas.setActiveObject(new ActiveSelection(objects, { canvas }));
      } finally {
        suppressReconcileRef.current = false;
      }
      canvas.requestRenderAll();
    };

    const onTextEditingEntered = (opt: { target?: FabricObject }) => {
      const target = opt.target;
      if (!(target instanceof IText)) return;
      editingRef.current = { text: target, host: (target.group ?? target) as FabricObject };
      useBoardStore.getState().commitHistory();
    };

    const onTextEditingExited = (opt: { target?: FabricObject }) => {
      const target = opt.target;
      if (!(target instanceof IText)) return;
      if (editingRef.current?.text === target) editingRef.current = null;
      // Fabric fires object:modified right after this event — swallow its
      // duplicate history commit for one microtask.
      suppressModifiedRef.current = true;
      queueMicrotask(() => {
        suppressModifiedRef.current = false;
      });

      const host = (target.group ?? target) as FabricObject;
      const id = elementId(host);
      const content = target.text ?? '';
      const wasFresh = freshTextIdRef.current === id;
      freshTextIdRef.current = null;
      if (!id) return;

      // A brand-new text element the user never typed into is just clutter.
      if (wasFresh && (!content.trim() || content === TEXT_PLACEHOLDER)) {
        useBoardStore.getState().removeElements([id]);
        return;
      }

      const el = serializeElement(host);
      if (el) commitLocalUpdate(id, { content, width: el.width, height: el.height });
      useBoardStore.getState().commitHistory();
      flushDeferred();
    };

    const onTextChanged = (opt: { target?: FabricObject }) => {
      // Sticky text lives on a child IText without its own id — sync via the group.
      const target = opt.target ?? canvas.getActiveObject();
      if (!target) return;
      const host = (target.group ?? target) as FabricObject;
      const el = serializeElement(host);
      const id = elementId(host);
      if (el && id) commitLocalUpdate(id, { content: el.content });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        setCursorsForTool(canvas, useToolStore.getState().tool);
        canvas.requestRenderAll();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftDownRef.current = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable;
      if (e.code === 'Space' && !e.repeat && !typing) {
        spaceDownRef.current = true;
        canvas.defaultCursor = CURSOR.grab;
        canvas.hoverCursor = CURSOR.grab;
        canvas.requestRenderAll();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftDownRef.current = true;
      if (e.key === 'Enter' && !typing && !editingRef.current) {
        const active = canvas.getActiveObject();
        if ((isLabelled(active) || active instanceof ConnectorShape) && useBoardStore.getState().canEdit) {
          e.preventDefault();
          startLabelEditRef.current(active);
        }
      }
    };
    const onPointerMove = () => {
      if (canvas.isDrawingMode) lastInkMoveRef.current = performance.now();
    };
    // Keys released while the window is unfocused never fire keyup.
    const onBlur = () => {
      spaceDownRef.current = false;
      shiftDownRef.current = false;
    };

    const onHoverIn = (opt: { target?: FabricObject }) => {
      if (opt.target instanceof ConnectorShape) {
        opt.target.hovered = true;
        canvas.requestRenderAll();
      }
    };
    const onHoverOut = (opt: { target?: FabricObject }) => {
      if (opt.target instanceof ConnectorShape) {
        opt.target.hovered = false;
        canvas.requestRenderAll();
      }
    };

    // Animated flow ("marching ants") — ticks only while an animated
    // connector is visible.
    let flowFrame: number | null = null;
    let lastFlow = 0;
    const flowTick = (now: number) => {
      const dt = lastFlow ? Math.min(64, now - lastFlow) : 16;
      lastFlow = now;
      let any = false;
      for (const o of canvas.getObjects()) {
        if (o instanceof ConnectorShape && o.model.animated && o.isOnScreen()) {
          o.flowOffset = (o.flowOffset + dt * 0.035) % 1000;
          any = true;
        }
      }
      if (any) canvas.requestRenderAll();
      flowFrame = any ? requestAnimationFrame(flowTick) : null;
      if (!any) lastFlow = 0;
    };
    const ensureFlow = () => {
      if (flowFrame === null && canvas.getObjects().some((o) => o instanceof ConnectorShape && o.model.animated)) {
        flowFrame = requestAnimationFrame(flowTick);
      }
    };
    const stopFlow = () => {
      if (flowFrame !== null) cancelAnimationFrame(flowFrame);
      flowFrame = null;
    };
    ensureFlowRef.current = ensureFlow;

    const onDoubleClick = (opt: TPointerEventInfo<TPointerEvent>) => {
      const target = opt.target;
      if (!target || !useBoardStore.getState().canEdit) return;

      if (isLabelled(target)) {
        startLabelEditRef.current(target);
        return;
      }

      if (target instanceof ConnectorShape) {
        const p = opt.scenePoint;
        const hit = nearestOnPath(target.path, p);
        const m = target.model;
        const labelPt = m.label ? pointAt(target.path, m.labelT).point : null;
        if (labelPt && Math.hypot(labelPt.x - p.x, labelPt.y - p.y) < 24) {
          startConnectorLabelEdit(target, m.labelT);
        } else if (m.routing !== 'elbow' && !target.path.selfLoop) {
          // Double-click a line to add a waypoint there.
          const model = target.bakedModel();
          model.waypoints.splice(Math.min(hit.span, model.waypoints.length), 0, hit.point);
          useBoardStore.getState().commitHistory();
          useBoardStore.getState().updateElement(target.connectorId, connectorPatch(model));
        } else {
          startConnectorLabelEdit(target, Math.min(0.95, Math.max(0.05, hit.t)));
        }
        return;
      }

      if (target instanceof IText) {
        if (!target.isEditing) {
          canvas.setActiveObject(target);
          target.enterEditing();
          target.selectAll();
        } else {
          const ta = (target as unknown as { hiddenTextarea?: HTMLTextAreaElement | null }).hiddenTextarea;
          ta?.focus();
        }
        return;
      }

      // Sticky note: the child IText is not evented — edit it via the group.
      if (target instanceof Group && elementKind(target) === 'sticky') {
        const textObj = target.getObjects().find((o): o is IText => o instanceof IText);
        if (!textObj) return;
        textObj.set({ editable: true });
        canvas.setActiveObject(target);
        canvas.requestRenderAll();
        textObj.enterEditing();
        textObj.selectAll();
      }
    };

    const onDrop = async (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      e.preventDefault();
      if (!useBoardStore.getState().canEdit) return readOnlyNotice();

      const rect = host.getBoundingClientRect();
      const world = useCanvasStore.getState().screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = findObjectAt(canvas, world.x, world.y);
      const targetId = hit && elementKind(hit) !== 'comment' ? elementId(hit) : undefined;

      await Promise.all(
        files.map((file, i) => {
          const at = { x: world.x + i * 24, y: world.y + i * 24 };
          // Images dropped on empty canvas become images; everything else
          // (or anything dropped onto an element) is an attachment.
          if (!targetId && file.type.startsWith('image/') && file.type !== 'image/gif') {
            return placeImage(file, at);
          }
          return attachFile(file, at, targetId);
        }),
      );
    };

    const onDragOver = (e: DragEvent) => e.preventDefault();

    canvas.on('mouse:wheel', onWheel);
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('mouse:dblclick', onDoubleClick);
    canvas.on('path:created', onPathCreated);
    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', onSelectionCleared);
    canvas.on('object:moving', onTransforming);
    canvas.on('object:scaling', onTransforming);
    canvas.on('object:rotating', onTransforming);
    canvas.on('object:modified', onObjectModified);
    canvas.on('text:changed', onTextChanged);
    canvas.on('text:editing:entered', onTextEditingEntered);
    canvas.on('text:editing:exited', onTextEditingExited);
    canvas.on('after:render', onAfterRender);
    canvas.on('mouse:over', onHoverIn);
    canvas.on('mouse:out', onHoverOut);

    window.addEventListener('keydown', onKeyDown);
    host.addEventListener('pointermove', onPointerMove, { capture: true });
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    host.addEventListener('dragover', onDragOver);
    host.addEventListener('drop', onDrop);
    host.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
    host.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
    host.addEventListener('touchend', onTouchEnd, { capture: true });

    return () => {
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('mouse:dblclick', onDoubleClick);
      canvas.off('path:created', onPathCreated);
      canvas.off('selection:created', onSelection);
      canvas.off('selection:updated', onSelection);
      canvas.off('selection:cleared', onSelectionCleared);
      canvas.off('object:moving', onTransforming);
      canvas.off('object:scaling', onTransforming);
      canvas.off('object:rotating', onTransforming);
      canvas.off('object:modified', onObjectModified);
      canvas.off('text:changed', onTextChanged);
      canvas.off('text:editing:entered', onTextEditingEntered);
      canvas.off('text:editing:exited', onTextEditingExited);
      canvas.off('after:render', onAfterRender);
      canvas.off('mouse:over', onHoverIn);
      canvas.off('mouse:out', onHoverOut);
      setConnectorEditHook(null);
      stopFlow();
      window.removeEventListener('vb:edit-label', onEditLabelRequest);
      stopInertia();
      window.removeEventListener('keydown', onKeyDown);
      host.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      host.removeEventListener('dragover', onDragOver);
      host.removeEventListener('drop', onDrop);
      host.removeEventListener('touchstart', onTouchStart, { capture: true });
      host.removeEventListener('touchmove', onTouchMove, { capture: true });
      host.removeEventListener('touchend', onTouchEnd, { capture: true });
      detachPreview();
      unsubscribePreviewTimers();
      previewTimers.forEach((t) => clearTimeout(t));
      reconcileRef.current = () => {};
    };
  }

  /* ---------------------------------------------------------------------- */
  /* Media placement                                                         */
  /* ---------------------------------------------------------------------- */

  /** Downscales an image and places it as an inline image element. */
  async function placeImage(file: File, at: { x: number; y: number }) {
    const canvas = useCanvasStore.getState().canvas;
    if (!canvas) return;
    const toastId = toast.loading(`Adding ${file.name}…`);
    try {
      const { dataUrl, width, height } = await imageToInlineDataUrl(file);
      const container = useCanvasStore.getState().container;
      const scale = useCanvasStore.getState().viewport.scale || 1;
      // Fit to ~40% of the visible area, never upscale.
      const maxW = ((container?.clientWidth ?? 800) * 0.4) / scale;
      const fit = Math.min(1, maxW / width);
      const el: BoardElement = {
        id: uid('el'),
        kind: 'image',
        x: at.x - (width * fit) / 2,
        y: at.y - (height * fit) / 2,
        width: width * fit,
        height: height * fit,
        rotation: 0,
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        content: dataUrl,
        version: 0,
      };
      const obj = materializeElement(el);
      canvas.add(obj);
      animateElementIn(obj);
      commitLocalCreate(el, obj);
      toast.success(`${file.name} added to the board`, { id: toastId });
    } catch (err) {
      toast.error(`Could not add ${file.name}`, {
        id: toastId,
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  /** Uploads a file and attaches it to an element, or drops a document card. */
  async function attachFile(file: File, at: { x: number; y: number }, targetId?: string) {
    const boardId = useBoardStore.getState().board?.id;
    const canvas = useCanvasStore.getState().canvas;
    if (!boardId || !canvas) return;
    if (useBoardStore.getState().isDemo) {
      toast.info('Attachments need a saved board', { description: 'Preview boards are not stored on the server.' });
      return;
    }
    const invalid = validateUploadFile(file);
    if (invalid) {
      toast.error('Upload skipped', { description: invalid });
      return;
    }

    const toastId = toast.loading(`Uploading ${file.name}…`);
    const res = await uploadDocument(boardId, file, targetId);
    if (!res.ok) {
      toast.error(`Could not upload ${file.name}`, { id: toastId, description: res.message });
      return;
    }
    // The user may have switched boards while the upload ran.
    if (useBoardStore.getState().board?.id !== boardId) {
      toast.dismiss(toastId);
      return;
    }
    const attachment: AttachmentMeta = res.attachment;

    if (targetId && useBoardStore.getState().board?.elements.some((el) => el.id === targetId)) {
      useBoardStore.getState().updateElement(targetId, { attachment });
      toast.success(`${file.name} attached`, { id: toastId, description: 'Click the badge to preview it.' });
      return;
    }

    const el: BoardElement = {
      id: uid('el'),
      kind: 'document',
      x: at.x - 100,
      y: at.y - 30,
      width: 200,
      height: 60,
      rotation: 0,
      fill: '#fbf1e8',
      stroke: '#e0a883',
      strokeWidth: 1,
      fontSize: 12,
      content: file.name,
      attachment,
      version: 0,
    };
    const obj = materializeElement(el);
    canvas.add(obj);
    animateElementIn(obj);
    commitLocalCreate(el, obj);
    toast.success(`${file.name} added to the board`, { id: toastId });
  }

  const pickAt = () => {
    const last = lastClickRef.current;
    if (last) return last;
    const container = useCanvasStore.getState().container;
    return useCanvasStore.getState().screenToWorld((container?.clientWidth ?? 0) / 2, (container?.clientHeight ?? 0) / 2);
  };

  const onImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    useToolStore.getState().setTool('select');
    if (file) void placeImage(file, pickAt());
  };

  const onDocumentPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    useToolStore.getState().setTool('select');
    const at = pickAt();
    files.forEach((file, i) => void attachFile(file, { x: at.x + i * 24, y: at.y + i * 24 }));
  };

  /* ---------------------------------------------------------------------- */
  /* Canvas lifecycle                                                        */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const canvasEl = document.createElement('canvas');
    host.appendChild(canvasEl);

    const canvas = new FabricCanvas(canvasEl, {
      selection: true,
      preserveObjectStacking: true,
      // Batched renders: we call requestRenderAll() after mutations.
      renderOnAddRemove: false,
      // Viewport culling: objects outside the visible area are not drawn.
      skipOffscreen: true,
      width: host.clientWidth,
      height: host.clientHeight,
    });

    canvas.setViewportTransform([1, 0, 0, 1, host.clientWidth / 2, host.clientHeight / 2]);
    useCanvasStore.getState().register(canvas, host);
    // Dev/e2e inspection handle; stripped from production builds.
    if (import.meta.env.DEV) (window as unknown as { __vbCanvas?: FabricCanvas }).__vbCanvas = canvas;
    const objectMap = objectMapRef.current;
    const synced = syncedRef.current;
    const deferred = deferredRef.current;

    const teardown = setupInteractions(canvas, host);

    // Text measured before the web fonts arrived keeps fallback metrics (and
    // a serif look) until something else re-renders it. Re-measure once fonts
    // finish loading.
    const remeasureText = () => {
      // Fabric caches glyph widths per font family; entries measured with the
      // fallback font would otherwise survive and clip the real text.
      cache.clearFontCache();
      const visit = (obj: FabricObject) => {
        if (obj instanceof IText) {
          obj.initDimensions();
          obj.setCoords();
          obj.set('dirty', true);
        }
        if (obj instanceof Group) {
          obj.getObjects().forEach(visit);
          obj.set('dirty', true);
        }
      };
      canvas.getObjects().forEach(visit);
      canvas.requestRenderAll();
    };
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    void fonts?.ready.then(remeasureText);
    fonts?.addEventListener('loadingdone', remeasureText);

    return () => {
      fonts?.removeEventListener('loadingdone', remeasureText);
      teardown();
      useCanvasStore.getState().unregister();
      objectMap.clear();
      synced.clear();
      deferred.clear();
      void canvas.dispose();
      if (canvasEl.parentNode === host) host.removeChild(canvasEl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- board store → canvas ----------------------------------------------
  useEffect(() => {
    let lastRevision: number | null = null;
    let lastBoardId: string | null = null;
    let lastCanEdit: boolean | null = null;

    /**
     * Keeps bound connectors attached after any shape change (drag, arrange,
     * undo, a collaborator's edit). Routing is deterministic, so every client
     * computes the same result and only the first one writes anything.
     */
    let maintenanceQueued = false;
    const maintainConnectors = () => {
      maintenanceQueued = false;
      const { board, canEdit, isDemo } = useBoardStore.getState();
      if (!board || (!canEdit && !isDemo) || useCanvasStore.getState().interacting) return;
      const scene = connectorScene();
      for (const el of board.elements) {
        if ((el.kind !== 'line' && el.kind !== 'arrow') || (!el.startBinding && !el.endBinding)) continue;
        const model = readConnector(el);
        const { start, end } = resolveEnds(model, scene);
        const pts = [start.point.x, start.point.y, end.point.x, end.point.y];
        if (!el.points) continue;
        const drift = Math.max(...pts.map((v, i) => Math.abs(v - (el.points![i] ?? 0))));
        if (drift < 0.5) continue;
        model.start.point = start.point;
        model.end.point = end.point;
        const patch = connectorPatch(model);
        useBoardStore.getState().applyDerivedUpdate(el.id, {
          points: patch.points,
          pointsAbsolute: true,
          x: patch.x,
          y: patch.y,
          width: patch.width,
          height: patch.height,
        });
      }
    };

    const run = () => {
      const { board, revision, canEdit } = useBoardStore.getState();
      const canvas = useCanvasStore.getState().canvas;
      if (!board || !canvas) return;
      const boardChanged = board.id !== lastBoardId;
      const full = boardChanged || revision !== lastRevision || canEdit !== lastCanEdit;
      lastRevision = revision;
      lastCanEdit = canEdit;
      lastBoardId = board.id;
      reconcileRef.current(full);
      if (boardChanged) useCanvasStore.getState().fitBox(unionBox(board.elements.map(elementBox)));
      useCanvasStore.getState().setReady(true);
      if (!maintenanceQueued) {
        maintenanceQueued = true;
        setTimeout(maintainConnectors, 0);
      }
    };
    // Re-check once a drag ends (maintenance is paused while interacting).
    const unsubscribeInteracting = useCanvasStore.subscribe((s, prev) => {
      if (prev.interacting && !s.interacting && !maintenanceQueued) {
        maintenanceQueued = true;
        setTimeout(maintainConnectors, 0);
      }
    });

    run();
    const unsubscribeBoard = useBoardStore.subscribe((state, prev) => {
      if (
        state.board?.elements === prev.board?.elements &&
        state.revision === prev.revision &&
        state.board?.id === prev.board?.id &&
        state.canEdit === prev.canEdit
      ) {
        return;
      }
      run();
    });
    return () => {
      unsubscribeBoard();
      unsubscribeInteracting();
    };
  }, []);

  // ----- theme change: re-render theme-adaptive ink ----------------------------
  useEffect(
    () =>
      useThemeStore.subscribe((state, prev) => {
        if (state.theme !== prev.theme) requestAnimationFrame(() => reconcileRef.current(true));
      }),
    [],
  );

  // ----- follow a collaborator's pointer ------------------------------------
  useEffect(() => {
    let lastTarget = '';
    return usePresenceStore.subscribe((state) => {
      const followingId = useUIStore.getState().followingId;
      if (!followingId) return;
      const user = state.users.find((u) => u.id === followingId);
      if (!user) {
        useUIStore.getState().setFollowing(null);
        return;
      }
      if (!user.cursor) return;
      const key = `${Math.round(user.cursor.x)},${Math.round(user.cursor.y)}`;
      if (key === lastTarget) return;
      lastTarget = key;
      const { container, viewport, animateTo } = useCanvasStore.getState();
      if (!container) return;
      animateTo(
        {
          scale: viewport.scale,
          x: container.clientWidth / 2 - user.cursor.x * viewport.scale,
          y: container.clientHeight / 2 - user.cursor.y * viewport.scale,
        },
        320,
      );
    });
  }, []);

  // ----- label editor ---------------------------------------------------------
  const commitLabel = (value: string, cancel = false) => {
    const edit = labelEdit;
    if (!edit) return;
    setLabelEdit(null);
    const obj = objectMapRef.current.get(edit.id);
    if (obj && isLabelled(obj)) {
      obj.labelHidden = false;
      obj.set('dirty', true);
      useCanvasStore.getState().canvas?.requestRenderAll();
    }
    if (edit.connectorT !== undefined) {
      if (!cancel && value !== edit.value) {
        useBoardStore.getState().updateElement(edit.id, { label: value.trim().slice(0, 200), labelT: edit.connectorT });
        useBoardStore.getState().commitHistory();
      }
      return;
    }
    if (!cancel && value !== edit.value) {
      useBoardStore.getState().updateElement(edit.id, { content: value.slice(0, 5000) });
      useBoardStore.getState().commitHistory();
    }
  };

  // ----- resize ------------------------------------------------------------
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      const { canvas, container } = useCanvasStore.getState();
      if (!canvas || !container) return;
      canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight });
      canvas.requestRenderAll();
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const gridStyle = useGridStyle();
  const gridVisible = useCanvasStore((s) => s.gridVisible);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" aria-label="Whiteboard canvas">
      {gridVisible && !empty && <div className="grid-paper absolute inset-0" style={gridStyle} aria-hidden="true" />}
      <div ref={canvasHostRef} className="absolute inset-0 z-10 touch-none" />

      {/* Drawing dimension chip — position/text written directly by mousemove */}
      <div
        ref={dimsRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-20 hidden rounded-md bg-ink px-2 py-1 font-mono text-[11px] font-medium text-paper shadow-lg"
        style={{ display: 'none' }}
      />

      {labelEdit && (
        <LabelEditor
          key={labelEdit.id}
          edit={labelEdit}
          onCommit={(value, cancel) => commitLabel(value, cancel)}
        />
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onImagePicked}
      />
      <input
        ref={docInputRef}
        type="file"
        multiple
        accept={ALLOWED_UPLOAD_TYPES.join(',')}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onDocumentPicked}
      />
      {empty && <EmptyBoard />}
      {loading && <CanvasSkeleton />}
    </div>
  );
}

function findObjectAt(canvas: FabricCanvas, x: number, y: number): FabricObject | null {
  const point = new Point(x, y);
  for (const obj of canvas.getObjects().slice().reverse()) {
    if (!obj.visible || obj.excludeFromExport || !elementId(obj)) continue;
    if (obj.containsPoint(point)) return obj;
  }
  return null;
}

function useGridStyle() {
  const viewport = useCanvasStore((s) => s.viewport);
  const size = Math.max(24 * viewport.scale, 8);
  return {
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `${viewport.x % size}px ${viewport.y % size}px`,
  } as React.CSSProperties;
}

/** In-place editor for shape labels: a textarea laid exactly over the shape. */
function LabelEditor({
  edit,
  onCommit,
}: {
  edit: { box: { x: number; y: number; w: number; h: number }; value: string; fontSize: number; color: string; circle: boolean };
  onCommit: (value: string, cancel?: boolean) => void;
}) {
  const viewport = useCanvasStore((s) => s.viewport);
  const [value, setValue] = useState(edit.value);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (cancel = false) => {
    if (done.current) return;
    done.current = true;
    onCommit(value, cancel);
  };

  const inset = edit.circle ? (edit.box.w * (1 - Math.SQRT1_2)) / 2 : 8;
  const left = (edit.box.x + inset) * viewport.scale + viewport.x;
  const top = (edit.box.y + inset) * viewport.scale + viewport.y;
  const width = Math.max(40, (edit.box.w - inset * 2) * viewport.scale);
  const height = Math.max(24, (edit.box.h - inset * 2) * viewport.scale);

  return (
    <div
      className="absolute z-30 flex items-center justify-center"
      style={{ left, top, width, height }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => finish()}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') finish(true);
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
            e.preventDefault();
            finish();
          }
        }}
        rows={1}
        placeholder="Label"
        aria-label="Shape label"
        className="max-h-full w-full resize-none overflow-hidden bg-transparent text-center font-medium leading-[1.3] outline-none placeholder:text-ink-3/60"
        style={{ fontSize: edit.fontSize * viewport.scale, color: edit.color }}
      />
    </div>
  );
}
