import { useEffect, useMemo, useRef } from 'react';
import {
  Canvas as FabricCanvas,
  FabricObject,
  Rect,
  Point,
  PencilBrush,
  FabricImage,
  type TPointerEventInfo,
  type TPointerEvent,
} from 'fabric';
import { toast } from 'sonner';
import { useBoardStore } from '../../stores/useBoardStore';
import { useToolStore } from '../../stores/useToolStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { usePresenceStore } from '../../stores/usePresenceStore';
import { useUIStore } from '../../stores/useUIStore';
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
  type DrawingState,
} from '../../services/fabric.elements';
import { uid } from '../../utils';
import type { AttachmentMeta, BoardElement } from '../../types';
import { CanvasSkeleton } from '../../components/ui/Skeleton';
import EmptyBoard from './EmptyBoard';

export default function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<DrawingState | null>(null);
  const selectionBoxRef = useRef<FabricObject | null>(null);
  const panningRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const spaceDownRef = useRef(false);
  const objectMapRef = useRef<Map<string, FabricObject>>(new Map());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const board = useBoardStore((s) => s.board);
  const revision = useBoardStore((s) => s.revision);
  const loading = useBoardStore((s) => s.loading);
  const tool = useToolStore((s) => s.tool);

  // ----- tool switching ----------------------------------------------------
  useEffect(() => {
    const canvas = useCanvasStore.getState().canvas;
    if (!canvas) return;
    const isPen = tool === 'pen';

    canvas.isDrawingMode = isPen;
    if (isPen) {
      const brush = new PencilBrush(canvas);
      brush.width = 2;
      brush.color = '#1b1a17';
      canvas.freeDrawingBrush = brush;
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    } else {
      canvas.selection = tool === 'select';
      canvas.defaultCursor = tool === 'hand' ? 'grab' : 'default';
      canvas.hoverCursor = 'default';
      if (canvas.getActiveObjects().length) {
        canvas.discardActiveObject();
        useBoardStore.getState().clearSelection();
        canvas.requestRenderAll();
      }
    }
  }, [tool]);

  const shouldPan = (e: MouseEvent) => tool === 'hand' || spaceDownRef.current || e.button === 1;

  function broadcastCursor(opt: TPointerEventInfo<TPointerEvent>) {
    const { screenToWorld } = useCanvasStore.getState();
    const pointer = opt.scenePoint ?? opt.viewportPoint;
    const world = screenToWorld(pointer.x, pointer.y);
    usePresenceStore.getState().updateLocalCursor(world.x, world.y, useToolStore.getState().tool);
  }

  function setupInteractions(canvas: FabricCanvas, host: HTMLDivElement) {
    const store = useCanvasStore.getState();

    const onWheel = (opt: TPointerEventInfo<TPointerEvent>) => {
      const e = opt.e as WheelEvent;
      e.preventDefault();
      e.stopPropagation();

      const rect = host.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.003);
        store.zoomBy(factor, { x: e.clientX - rect.left, y: e.clientY - rect.top });
      } else if (e.shiftKey) {
        store.panBy(-e.deltaY, 0);
      } else {
        store.panBy(-e.deltaX, -e.deltaY);
      }
    };

    const onMouseDown = (opt: TPointerEventInfo<TPointerEvent>) => {
      const e = opt.e as MouseEvent;
      if (shouldPan(e)) {
        panningRef.current = { lastX: e.clientX, lastY: e.clientY };
        canvas.selection = false;
        canvas.defaultCursor = 'grabbing';
        if (canvas.getActiveObject()) {
          canvas.discardActiveObject();
          useBoardStore.getState().clearSelection();
        }
        canvas.requestRenderAll();
        return;
      }

      const pointer = opt.scenePoint ?? opt.viewportPoint;

      if (tool === 'image') {
        fileInputRef.current?.click();
        return;
      }
      if (tool === 'document') {
        const el: BoardElement = {
          id: uid('el'),
          kind: 'document',
          x: pointer.x - 100,
          y: pointer.y - 30,
          width: 200,
          height: 60,
          rotation: 0,
          fill: '#fbf1e8',
          stroke: '#e0a883',
          strokeWidth: 1,
          fontSize: 12,
          content: 'document.pdf',
          version: 1,
        };
        useBoardStore.getState().addElement(el);
        toast.info('Drop a file onto the card to attach it');
        return;
      }

      // handle select rubber-band start
      if (tool === 'select') {
        const hit = findObjectAt(canvas, pointer.x, pointer.y);
        if (!hit) {
          // start selection box
          const rect = new (Rect as any)({
            left: pointer.x,
            top: pointer.y,
            width: 1,
            height: 1,
            fill: 'rgba(0,0,0,0.08)',
            stroke: 'rgba(0,0,0,0.12)',
            strokeWidth: 1,
            selectable: false,
            evented: false,
            excludeFromExport: true,
          });
          selectionBoxRef.current = rect;
          canvas.add(rect);
          canvas.requestRenderAll();
          return;
        }
      }

      const drawing = startDrawing(canvas, tool as DrawingState['kind'], pointer);

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
          content: 'Type something…',
          version: 1,
        };
        const obj = materializeElement(el);
        canvas.add(obj);
        objectMapRef.current.set(el.id, obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        (canvas as unknown as { enterEditing: (o: unknown) => void }).enterEditing(obj);
      } else if (drawing.type === 'comment' && drawing.object) {
        const el = endDrawing(canvas, drawing, pointer);
        drawingRef.current = null;
        if (el) {
          useBoardStore.getState().addElement(el);
          useBoardStore.getState().addComment('', { elementId: el.id, x: el.x, y: el.y });
          useUIStore.getState().setActiveComment({ elementId: el.id, x: el.x, y: el.y });
          useUIStore.getState().setRightPanelTab('comments');
        }
      } else if (drawing.type === 'shape') {
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
        store.panBy(dx, dy);
        return;
      }
      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current as any;
        box.set({
          left: Math.min(box.left, opt.scenePoint?.x ?? opt.viewportPoint.x),
          top: Math.min(box.top, opt.scenePoint?.y ?? opt.viewportPoint.y),
          width: Math.abs((opt.scenePoint?.x ?? opt.viewportPoint.x) - box.left),
          height: Math.abs((opt.scenePoint?.y ?? opt.viewportPoint.y) - box.top),
        });
        canvas.requestRenderAll();
      } else if (drawingRef.current) {
        const pointer = opt.scenePoint ?? opt.viewportPoint;
        updateDrawing(canvas, drawingRef.current, pointer);
      }
      broadcastCursor(opt);
    };

    const onMouseUp = (opt: TPointerEventInfo<TPointerEvent>) => {
      if (panningRef.current) {
        panningRef.current = null;
        canvas.selection = tool === 'select';
        canvas.defaultCursor = tool === 'hand' ? 'grab' : 'default';
        canvas.requestRenderAll();
        return;
      }
      if (selectionBoxRef.current) {
        const box = selectionBoxRef.current as any;
        const bounds = box.getBoundingRect();
        const ids: string[] = [];
        for (const obj of canvas.getObjects()) {
          if (!obj.visible || obj.excludeFromExport) continue;
          const b = obj.getBoundingRect();
          // simple intersection test
          if (
            b.left < bounds.left + bounds.width &&
            b.left + b.width > bounds.left &&
            b.top < bounds.top + bounds.height &&
            b.top + b.height > bounds.top
          ) {
            const id = elementId(obj);
            if (id) ids.push(id);
          }
        }
        canvas.remove(box);
        selectionBoxRef.current = null;
        if (ids.length) {
          useBoardStore.getState().select(ids);
        } else {
          useBoardStore.getState().select([]);
        }
        canvas.requestRenderAll();
        return;
      }

      if (drawingRef.current) {
        const pointer = opt.scenePoint ?? opt.viewportPoint;
        const el = endDrawing(canvas, drawingRef.current, pointer);
        drawingRef.current = null;
        if (el) {
          useBoardStore.getState().addElement(el);
          useBoardStore.getState().select([el.id]);
        }
      }
    };

    const onPathCreated = (opt: { path?: FabricObject }) => {
      if (!opt.path) return;
      const el = serializeElement(opt.path);
      if (el) {
        el.id = uid('el');
        el.kind = 'pen';
        const obj = materializeElement(el);
        canvas.remove(opt.path);
        canvas.add(obj);
        objectMapRef.current.set(el.id, obj);
        useBoardStore.getState().addElement(el);
      }
    };

    const onSelection = () => {
      const ids = canvas.getActiveObjects().map((o) => elementId(o)).filter(Boolean) as string[];
      useBoardStore.getState().select(ids);
    };

    const onObjectModified = () => {
      const active = canvas.getActiveObjects();
      if (!active.length) return;
      const { updateElement, commitHistory } = useBoardStore.getState();
      commitHistory();
      active.forEach((obj) => {
        const el = serializeElement(obj);
        const id = elementId(obj);
        if (el && id) {
          const { x, y, width, height, rotation, points, pointsToPath } = el;
          updateElement(id, { x, y, width, height, rotation, points, pointsToPath });
        }
      });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDownRef.current = true;
    };

    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      e.preventDefault();

      const rect = host.getBoundingClientRect();
      const world = useCanvasStore.getState().screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = findObjectAt(canvas, world.x, world.y);

      files.forEach((file) => {
        const attachment: AttachmentMeta = {
          id: uid('att'),
          name: file.name,
          type: file.type || 'application/octet-stream',
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };

        if (hit && elementKind(hit) !== 'comment') {
          const id = elementId(hit);
          if (id) {
            useBoardStore.getState().updateElement(id, { attachment });
            asVB(hit).data = { ...asVB(hit).data, attachment };
            canvas.requestRenderAll();
          }
          toast.success(`${file.name} attached`, { description: 'Hover the element to inspect the file.' });
        } else {
          const el = {
            id: uid('el'),
            kind: 'document' as const,
            x: world.x - 100,
            y: world.y - 30,
            width: 200,
            height: 60,
            rotation: 0,
            fill: '#fbf1e8',
            stroke: '#e0a883',
            strokeWidth: 1,
            fontSize: 12,
            content: file.name,
            attachment,
            version: 1,
          };
          useBoardStore.getState().addElement(el);
          toast.success(`${file.name} added to the board`);
        }
      });
    };

    canvas.on('mouse:wheel', onWheel);
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('path:created', onPathCreated);
    canvas.on('selection:created', onSelection);
    canvas.on('selection:updated', onSelection);
    canvas.on('selection:cleared', () => useBoardStore.getState().select([]));
    canvas.on('object:modified', onObjectModified);
    canvas.on('text:changed', () => {
      const active = canvas.getActiveObject();
      if (!active) return;
      const el = serializeElement(active);
      const id = elementId(active);
      if (el && id) useBoardStore.getState().updateElement(id, { content: el.content });
    });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    host.addEventListener('dragover', (e) => e.preventDefault());
    host.addEventListener('drop', onDrop);

    return () => {
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('path:created', onPathCreated);
      canvas.off('selection:created', onSelection);
      canvas.off('selection:updated', onSelection);
      canvas.off('selection:cleared');
      canvas.off('object:modified', onObjectModified);
      canvas.off('text:changed');
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      host.removeEventListener('drop', onDrop);
    };
  }

  // ----- canvas lifecycle -------------------------------------------------
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const canvasEl = document.createElement('canvas');
    host.appendChild(canvasEl);

    const canvas = new FabricCanvas(canvasEl, {
      selection: true,
      preserveObjectStacking: true,
      renderOnAddRemove: true,
      width: host.clientWidth,
      height: host.clientHeight,
    });

    canvas.setViewportTransform([1, 0, 0, 1, host.clientWidth / 2, host.clientHeight / 2]);

    useCanvasStore.getState().register(canvas, host);

    const teardown = setupInteractions(canvas, host);
    return () => {
      teardown();
      useCanvasStore.getState().unregister();
      canvas.dispose();
      host.removeChild(canvasEl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- resize ------------------------------------------------------------
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      const canvas = useCanvasStore.getState().canvas;
      const container = useCanvasStore.getState().container;
      if (!canvas || !container) return;
      canvas.setDimensions({ width: container.clientWidth, height: container.clientHeight });
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  // ----- materialize board elements on load / undo / redo ------------------
  useEffect(() => {
    const canvas = useCanvasStore.getState().canvas;
    if (!canvas || !board) return;

    removeTmpObjects(canvas);
    canvas.clear();
    objectMapRef.current.clear();

    board.elements.forEach((el) => {
      const obj = materializeElement(el);
      canvas.add(obj);
      objectMapRef.current.set(el.id, obj);
    });

    canvas.requestRenderAll();
    fitBoardToView(canvas);
    useCanvasStore.getState().setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, revision]);

  const empty = useMemo(() => (board ? board.elements.length === 0 : false), [board]);

  const gridStyle = useGridStyle();
  const gridVisible = useCanvasStore((s) => s.gridVisible);

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      aria-label="Whiteboard canvas"
    >
      {gridVisible && !empty && (
        <div className="grid-paper absolute inset-0" style={gridStyle} aria-hidden="true" />
      )}
      <div ref={canvasHostRef} className="absolute inset-0 z-10" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onImagePicked}
      />
      {empty && <EmptyBoard />}
      {loading && <CanvasSkeleton />}
    </div>
  );
}

async function onImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  const canvas = useCanvasStore.getState().canvas;
  if (!canvas) return;

  try {
    const url = URL.createObjectURL(file);
    const img = await FabricImage.fromURL(url);
    const container = useCanvasStore.getState().container;
    const maxW = Math.min(320, (container?.clientWidth ?? 600) * 0.4);
    const scale = Math.min(1, maxW / img.width);

    const el: BoardElement = {
      id: uid('el'),
      kind: 'image',
      x: (container?.clientWidth ?? 0) / 2 - (img.width * scale) / 2,
      y: (container?.clientHeight ?? 0) / 2 - (img.height * scale) / 2,
      width: img.width * scale,
      height: img.height * scale,
      rotation: 0,
      fill: 'transparent',
      stroke: 'transparent',
      strokeWidth: 0,
      content: url,
      version: 1,
    };
    img.set({
      left: el.x,
      top: el.y,
      scaleX: scale,
      scaleY: scale,
      objectCaching: false,
    });
    asVB(img).data = { id: el.id, kind: 'image' };
    canvas.add(img);
    useBoardStore.getState().addElement(el);
    toast.success(`${file.name} added to the board`);
  } catch {
    toast.error('Could not load that image');
  }
}

function findObjectAt(canvas: FabricCanvas, x: number, y: number): FabricObject | null {
  const point = new Point(x, y);
  for (const obj of canvas.getObjects().slice().reverse()) {
    if (!obj.visible || obj.excludeFromExport) continue;
    if (obj.containsPoint(point)) return obj;
  }
  return null;
}

function fitBoardToView(canvas: FabricCanvas) {
  const objects = canvas.getObjects();
  if (!objects.length) return;
  const container = useCanvasStore.getState().container;
  if (!container) return;

  const bounds = objects.reduce(
    (acc, obj) => {
      const b = obj.getBoundingRect();
      return {
        minX: Math.min(acc.minX, b.left),
        minY: Math.min(acc.minY, b.top),
        maxX: Math.max(acc.maxX, b.left + b.width),
        maxY: Math.max(acc.maxY, b.top + b.height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  const pad = 140;
  const w = bounds.maxX - bounds.minX + pad * 2;
  const h = bounds.maxY - bounds.minY + pad * 2;
  const scale = Math.min(container.clientWidth / w, container.clientHeight / h, 1);

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;

  canvas.setViewportTransform([
    scale, 0, 0, scale,
    container.clientWidth / 2 - centerX * scale,
    container.clientHeight / 2 - centerY * scale,
  ]);
  useCanvasStore.getState().applyViewport();
}

function useGridStyle() {
  const viewport = useCanvasStore((s) => s.viewport);
  const size = Math.max(24 * viewport.scale, 8);
  return {
    backgroundSize: `${size}px ${size}px`,
    backgroundPosition: `${viewport.x % size}px ${viewport.y % size}px`,
  } as React.CSSProperties;
}