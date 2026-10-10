import { useEffect, useMemo, useRef } from 'react';
import {
  Canvas as FabricCanvas,
  FabricObject,
  Rect,
  Point,
  PencilBrush,
  FabricImage,
  ActiveSelection,
  IText,
  Group,
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
  TEXT_PLACEHOLDER,
  type DrawingState,
} from '../../services/fabric.elements';
import { animateElementIn } from '../../animations/boardAnimations';
import { uid } from '../../utils';
import { uploadDocument } from '../../api/document.api';
import type { BoardElement } from '../../types';
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
} as const;

const SHAPE_TOOLS = new Set([
  'rect', 'circle', 'triangle', 'ellipse', 'line', 'arrow',
  'sticky', 'image', 'document', 'comment', 'pen',
]);

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
  canvas.defaultCursor = CURSOR.arrow;
  canvas.hoverCursor = CURSOR.arrowAccent;
}

/** Canvas carrying a ref to the last click position (for image placement). */
type CanvasWithLastClick = FabricCanvas & {
  _lastClickRef?: { current: { x: number; y: number } | null };
};

/** Exits editing on any IText (including sticky-note children) that is open. */
function exitEditingTexts(canvas: FabricCanvas) {
  const visit = (obj: FabricObject) => {
    if (obj instanceof IText && obj.isEditing) obj.exitEditing();
    if (obj instanceof Group) obj.getObjects().forEach(visit);
  };
  canvas.getObjects().forEach(visit);
}

export default function CanvasStage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasHostRef = useRef<HTMLDivElement>(null);
  const drawingRef = useRef<DrawingState | null>(null);
  const selectionBoxRef = useRef<FabricObject | null>(null);
  const selectionOriginRef = useRef<{ x: number; y: number } | null>(null);
  const panningRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const spaceDownRef = useRef(false);
  const shiftDownRef = useRef(false);
  const objectMapRef = useRef<Map<string, FabricObject>>(new Map());
  const loadedBoardRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastClickRef = useRef<{ x: number; y: number } | null>(null);
  const editingRef = useRef<{ text: IText; host: FabricObject } | null>(null);
  const freshTextIdRef = useRef<string | null>(null);
  const suppressModifiedRef = useRef(false);
  const dimsRef = useRef<HTMLDivElement>(null);

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

  const board = useBoardStore((s) => s.board);
  const revision = useBoardStore((s) => s.revision);
  const loading = useBoardStore((s) => s.loading);
  const tool = useToolStore((s) => s.tool);
  const penWidth = useToolStore((s) => s.penWidth);
  const penColor = useToolStore((s) => s.penColor);

  // ----- tool switching ----------------------------------------------------
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

    const isPen = tool === 'pen';

    canvas.isDrawingMode = isPen;
    if (isPen) {
      const brush = new PencilBrush(canvas);
      brush.width = penWidth;
      brush.color = penColor;
      canvas.freeDrawingBrush = brush;
      canvas.selection = false;
      canvas.skipTargetFind = false;
      canvas.freeDrawingCursor = CURSOR.crosshair;
      setCursorsForTool(canvas, tool);
    } else if (tool === 'hand') {
      canvas.selection = false;
      canvas.skipTargetFind = true;
      setCursorsForTool(canvas, tool);
      if (canvas.getActiveObjects().length) {
        canvas.discardActiveObject();
        useBoardStore.getState().clearSelection();
        canvas.requestRenderAll();
      }
    } else {
      canvas.selection = tool === 'select';
      canvas.skipTargetFind = false;
      setCursorsForTool(canvas, tool);
      // Only discard selection when switching to a non-select tool
      if (tool !== 'select' && canvas.getActiveObjects().length) {
        canvas.discardActiveObject();
        useBoardStore.getState().clearSelection();
        canvas.requestRenderAll();
      }
    }
  }, [tool, penWidth, penColor]);

  const shouldPan = (e: MouseEvent) => {
    const current = useToolStore.getState().tool;
    return current === 'hand' || spaceDownRef.current || e.button === 1;
  };

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
      const pointer = opt.scenePoint ?? opt.viewportPoint;
      // Read the current tool live — never a stale render-time value.
      const activeTool = useToolStore.getState().tool;

      // Clicks outside the host being edited end text editing first
      // (sticky children are never the active object, so fabric won't do it).
      const editing = editingRef.current;
      if (editing && editing.text.isEditing) {
        const sameHost = opt.target === editing.host || opt.target === editing.text;
        if (sameHost) {
          const ta = (editing.text as unknown as { hiddenTextarea?: HTMLTextAreaElement | null })
            .hiddenTextarea;
          ta?.focus();
        } else {
          editing.text.exitEditing();
        }
      }

      // Store last click position for image placement
      lastClickRef.current = { x: pointer.x, y: pointer.y };

      if (shouldPan(e)) {
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

      if (activeTool === 'image') {
        fileInputRef.current?.click();
        return;
      }
      if (activeTool === 'document') {
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
        const obj = materializeElement(el);
        canvas.add(obj);
        objectMapRef.current.set(el.id, obj);
        animateElementIn(obj);
        useBoardStore.getState().addElement(el);
        toast.info('Drop a file onto the card to attach it');
        useToolStore.getState().setTool('select');
        return;
      }

      // Pen strokes are driven entirely by fabric's free-drawing brush.
      if (activeTool === 'pen') return;

      // handle select rubber-band start
      if (activeTool === 'select') {
        const hit = findObjectAt(canvas, pointer.x, pointer.y);
        if (!hit) {
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
          return;
        }
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
          version: 1,
        };
        const obj = materializeElement(el);
        canvas.add(obj);
        objectMapRef.current.set(el.id, obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
        // Register before entering editing so history captures the
        // placeholder state as the undo point for this new element.
        useBoardStore.getState().addElement(el);
        freshTextIdRef.current = el.id;
        if (obj instanceof IText) {
          obj.enterEditing();
          obj.selectAll();
        }
        useToolStore.getState().setTool('select');
      } else if (drawing.type === 'comment' && drawing.object) {
        const el = endDrawing(canvas, drawing, pointer);
        drawingRef.current = null;
        if (el) {
          useBoardStore.getState().addElement(el);
          useBoardStore.getState().addComment('', { elementId: el.id, x: el.x, y: el.y });
          useUIStore.getState().setActiveComment({ elementId: el.id, x: el.x, y: el.y });
          useUIStore.getState().setRightPanelTab('comments');
        }
        useToolStore.getState().setTool('select');
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
      if (selectionBoxRef.current && selectionOriginRef.current) {
        const origX = selectionOriginRef.current.x;
        const origY = selectionOriginRef.current.y;
        const curX = opt.scenePoint?.x ?? opt.viewportPoint.x;
        const curY = opt.scenePoint?.y ?? opt.viewportPoint.y;
        const box = selectionBoxRef.current;
        box.set({
          left: Math.min(origX, curX),
          top: Math.min(origY, curY),
          width: Math.max(1, Math.abs(curX - origX)),
          height: Math.max(1, Math.abs(curY - origY)),
        });
        canvas.requestRenderAll();
      } else if (drawingRef.current) {
        const pointer = opt.scenePoint ?? opt.viewportPoint;
        const gridVisible = useCanvasStore.getState().gridVisible;
        const dims = updateDrawing(canvas, drawingRef.current, pointer, {
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
      const activeTool = useToolStore.getState().tool;
      if (panningRef.current) {
        panningRef.current = null;
        canvas.selection = activeTool === 'select';
        canvas.skipTargetFind = activeTool === 'hand';
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
            if (id) {
              ids.push(id);
              selectedObjects.push(obj);
            }
          }
        }

        if (selectedObjects.length > 1) {
          const activeSel = new ActiveSelection(selectedObjects, { canvas });
          canvas.setActiveObject(activeSel);
          useBoardStore.getState().select(ids);
        } else if (selectedObjects.length === 1) {
          canvas.setActiveObject(selectedObjects[0]);
          useBoardStore.getState().select(ids);
        } else {
          canvas.discardActiveObject();
          useBoardStore.getState().select([]);
        }
        canvas.requestRenderAll();
        return;
      }

      if (drawingRef.current) {
        const pointer = opt.scenePoint ?? opt.viewportPoint;
        const gridVisible = useCanvasStore.getState().gridVisible;
        const el = endDrawing(canvas, drawingRef.current, pointer, {
          shift: shiftDownRef.current,
          snapGrid: gridVisible,
        });
        drawingRef.current = null;
        if (el) {
          // endDrawing already removed temp object, now materialize the final element
          const finalObj = materializeElement(el);
          canvas.add(finalObj);
          objectMapRef.current.set(el.id, finalObj);
          animateElementIn(finalObj);
          canvas.setActiveObject(finalObj);
          canvas.requestRenderAll();

          useBoardStore.getState().addElement(el);
          useBoardStore.getState().select([el.id]);
          // Auto-switch back to select tool after drawing
          useToolStore.getState().setTool('select');
        }
      }
    };

    const onPathCreated = (opt: { path?: FabricObject }) => {
      if (!opt.path) return;
      // The raw fabric path has no app data, so stamp a stable id + kind
      // before serializing. Without this the stroke is never registered in
      // board state and never persisted.
      asVB(opt.path).data = { id: uid('el'), kind: 'pen' };
      const el = serializeElement(opt.path);
      if (!el) return;
      // Preserve the pen settings
      el.stroke = useToolStore.getState().penColor;
      el.strokeWidth = useToolStore.getState().penWidth;
      const obj = materializeElement(el);
      canvas.remove(opt.path);
      canvas.add(obj);
      objectMapRef.current.set(el.id, obj);
      animateElementIn(obj);
      useBoardStore.getState().addElement(el);
    };

    const onSelection = () => {
      const ids = canvas.getActiveObjects().map((o) => elementId(o)).filter(Boolean) as string[];
      useBoardStore.getState().select(ids);
    };

    const onObjectModified = () => {
      // Exiting text editing fires a synthetic object:modified — the
      // pre-edit history point was already captured on editing:entered.
      if (suppressModifiedRef.current) {
        suppressModifiedRef.current = false;
        return;
      }
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

    const onTextEditingEntered = (opt: { target?: FabricObject }) => {
      const target = opt.target;
      if (!(target instanceof IText)) return;
      editingRef.current = { text: target, host: (target.group ?? target) as FabricObject };
      // Snapshot the pre-typing state so the first undo restores it.
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
      if (el) {
        useBoardStore.getState().updateElement(id, { content, width: el.width, height: el.height });
      }
    };

    const onTextChanged = (opt: { target?: FabricObject }) => {
      // Sticky text lives on a child IText without its own id — sync via the group.
      const target = opt.target ?? canvas.getActiveObject();
      if (!target) return;
      const host = (target.group ?? target) as FabricObject;
      const el = serializeElement(host);
      const id = elementId(host);
      if (el && id) useBoardStore.getState().updateElement(id, { content: el.content });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const currentTool = useToolStore.getState().tool;
      if (e.code === 'Space') {
        spaceDownRef.current = false;
        setCursorsForTool(canvas, currentTool);
        canvas.requestRenderAll();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftDownRef.current = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement)?.isContentEditable)) {
        spaceDownRef.current = true;
        canvas.defaultCursor = CURSOR.grab;
        canvas.hoverCursor = CURSOR.grab;
        canvas.requestRenderAll();
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') shiftDownRef.current = true;
    };

    const onDoubleClick = (opt: TPointerEventInfo<TPointerEvent>) => {
      const target = opt.target;
      if (!target) return;

      // Plain text: fabric already entered editing on the 2nd click —
      // only enter when it somehow didn't, and refocus the hidden input
      // when it did.
      if (target instanceof IText) {
        if (!target.isEditing) {
          canvas.setActiveObject(target);
          target.enterEditing();
          target.selectAll();
        } else {
          const ta = (target as unknown as { hiddenTextarea?: HTMLTextAreaElement | null })
            .hiddenTextarea;
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

      const boardId = useBoardStore.getState().board?.id;
      if (!boardId) return;

      const rect = host.getBoundingClientRect();
      const world = useCanvasStore.getState().screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const hit = findObjectAt(canvas, world.x, world.y);
      const targetId =
        hit && elementKind(hit) !== 'comment' ? elementId(hit) : undefined;

      for (const file of files) {
        // Upload the actual file so it is persisted and downloadable.
        const res = await uploadDocument(boardId, file, targetId);
        if (!res.ok) {
          toast.error(`Could not upload ${file.name}`, { description: res.message });
          continue;
        }
        const attachment = res.attachment;

        if (targetId) {
          useBoardStore.getState().updateElement(targetId, { attachment });
          if (hit) {
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
          const obj = materializeElement(el);
          canvas.add(obj);
          objectMapRef.current.set(el.id, obj);
          animateElementIn(obj);
          useBoardStore.getState().addElement(el);
          toast.success(`${file.name} added to the board`);
        }
      }
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
    canvas.on('selection:cleared', () => useBoardStore.getState().select([]));
    canvas.on('object:modified', onObjectModified);
    canvas.on('text:changed', onTextChanged);
    canvas.on('text:editing:entered', onTextEditingEntered);
    canvas.on('text:editing:exited', onTextEditingExited);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    host.addEventListener('dragover', onDragOver);
    host.addEventListener('drop', onDrop);

    return () => {
      canvas.off('mouse:wheel', onWheel);
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
      canvas.off('mouse:dblclick', onDoubleClick);
      canvas.off('path:created', onPathCreated);
      canvas.off('selection:created', onSelection);
      canvas.off('selection:updated', onSelection);
      canvas.off('selection:cleared');
      canvas.off('object:modified', onObjectModified);
      canvas.off('text:changed', onTextChanged);
      canvas.off('text:editing:entered', onTextEditingEntered);
      canvas.off('text:editing:exited', onTextEditingExited);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      host.removeEventListener('dragover', onDragOver);
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

    // Store lastClickRef on canvas for image placement
    (canvas as CanvasWithLastClick)._lastClickRef = lastClickRef;

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
    const shouldFit = loadedBoardRef.current !== board.id;
    loadedBoardRef.current = board.id;
    if (shouldFit) fitBoardToView(canvas);
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

      {/* Drawing dimension chip — position/text written directly by mousemove */}
      <div
        ref={dimsRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 z-20 hidden rounded-md bg-ink px-2 py-1 font-mono text-[11px] font-medium text-paper shadow-lg"
        style={{ display: 'none' }}
      />

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

    // Use last click position if available, otherwise center
    const lastClick = (canvas as CanvasWithLastClick)._lastClickRef?.current;
    const x = lastClick?.x ?? (container?.clientWidth ?? 0) / 2;
    const y = lastClick?.y ?? (container?.clientHeight ?? 0) / 2;

    const el: BoardElement = {
      id: uid('el'),
      kind: 'image',
      x: x - (img.width * scale) / 2,
      y: y - (img.height * scale) / 2,
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
    animateElementIn(img);
    useBoardStore.getState().addElement(el);
    useToolStore.getState().setTool('select');
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