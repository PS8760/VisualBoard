import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EyeOff } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import TopBar from './TopBar';
import Toolbar from './Toolbar';
import PenToolbar from './PenToolbar';
import OnboardingOverlay from './OnboardingOverlay';
import HelpButton from './HelpButton';
import StatusBar from './StatusBar';
import CanvasStage from './CanvasStage';
import RightPanel from './RightPanel';
import CommandPalette from './CommandPalette';
import VersionTimeline from './VersionTimeline';
import CursorsOverlay from './CursorsOverlay';
import ElementOverlays from './ElementOverlays';
import DocumentPreview from './DocumentPreview';
import ArrangeAnalyzing from './ArrangeAnalyzing';
import { ConnectionBanner, ArrangeBadge } from './ConnectionBanner';
import { CanvasSkeleton } from '../../components/ui/Skeleton';
import { useBoardStore } from '../../stores/useBoardStore';
import { useCanvasStore } from '../../stores/useCanvasStore';
import { usePresenceStore } from '../../stores/usePresenceStore';
import { useUIStore } from '../../stores/useUIStore';
import { useToolStore } from '../../stores/useToolStore';
import { useAuthStore } from '../../stores/useAuthStore';
import { useSuggestionStore } from '../../stores/useSuggestionStore';
import { useHotkeys } from '../../hooks/useHotkeys';
import { toast } from 'sonner';
import { attachRealtimeListeners, pendingCount } from '../../services/realtime';
import { fetchBoard } from '../../api/board.api';
import { INITIAL_ELEMENTS } from './boardSeeds';
import { uid } from '../../utils';
import { bindableAt } from '../../services/geometry';
import BoardSettingsModal from './BoardSettingsModal';
import SelectionToolbar from './SelectionToolbar';
import NavigationDock from './NavigationDock';
import LaserOverlay from './LaserOverlay';
import DiffOverlay from './DiffOverlay';
import { fitToContent, zoomAroundCenter } from '../../services/viewport';
import type { Tool } from '../../types';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select',
  h: 'hand',
  p: 'pen',
  r: 'rect',
  o: 'circle',
  l: 'line',
  a: 'arrow',
  t: 'text',
  s: 'sticky',
  c: 'comment',
  k: 'laser',
  // Advertised in the toolbar tooltips but previously never bound.
  i: 'image',
  d: 'document',
};

export default function Board() {
  const { id } = useParams<{ id: string }>();
  const boardId = id ?? 'demo-architecture';
  const loadedRef = useRef(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const loading = useBoardStore((s) => s.loading);
  const board = useBoardStore((s) => s.board);
  const load = useBoardStore((s) => s.load);
  const setTool = useToolStore((s) => s.setTool);
  const setCommandPalette = useUIStore((s) => s.setCommandPalette);
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);

  // Keep the header in sync when the settings modal renames the board. Only
  // metadata is refreshed — a full reload would discard queued edits.
  useEffect(() => {
    const onRenamed = () => {
      void fetchBoard(boardId).then((res) => {
        if (res.ok && res.board && useBoardStore.getState().board?.id === boardId) {
          useBoardStore.getState().applyBoardMeta({ title: res.board.title, description: res.board.description });
        }
      });
    };
    window.addEventListener('vb:board-renamed', onRenamed);
    return () => window.removeEventListener('vb:board-renamed', onRenamed);
  }, [boardId]);

  // ---- load board -----------------------------------------------------------
  useEffect(() => {
    if (loadedRef.current && useBoardStore.getState().board?.id === boardId) return;
    loadedRef.current = true;
    load(boardId);
  }, [boardId, load]);

  // ---- local presence user --------------------------------------------------
  useEffect(() => {
    const presence = usePresenceStore.getState();
    const authUser = useAuthStore.getState().user;
    if (!presence.users.some((u) => u.isLocal)) {
      presence.addLocalUser({
        id: authUser?.id ?? 'u_local',
        name: authUser?.name ?? 'You',
        color: authUser?.color ?? '#d9480f',
      });
    }
  }, []);

  // ---- realtime -------------------------------------------------------------
  useEffect(() => {
    const detach = attachRealtimeListeners();
    usePresenceStore.getState().connect(boardId);
    return () => {
      if (pendingCount(boardId) > 0) {
        toast.warning('Some recent changes may not have been saved', {
          description: 'You left the board while it was still syncing.',
        });
      }
      detach();
      usePresenceStore.getState().disconnect();
    };
  }, [boardId]);

  // ---- architecture suggestions (local rule-based engine) ------------------
  useEffect(() => {
    if (!board?.id) return;
    const suggestions = useBoardStore.getState().suggestions();
    useSuggestionStore.getState().evaluate(suggestions);
  }, [board?.id, board?.elements.length]);

  // ---- seed content for fresh boards ------------------------------------------
  useEffect(() => {
    if (!board || board.elements.length) return;
    if (useBoardStore.getState().isDemo) return;
    // Only seed genuinely new boards, and only once per board — regenerating
    // demo content on load made existing projects look like they "became demo".
    const createdAt = Date.parse(board.createdAt);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > 15 * 60_000) return;
    const marker = `vb:seeded:${board.id}`;
    try {
      if (window.localStorage.getItem(marker)) return;
      window.localStorage.setItem(marker, '1');
    } catch {
      // storage unavailable — the age gate alone still protects old boards
    }
    const store = useBoardStore.getState();
    // Element ids are global primary keys: fresh ids per board, or only the
    // very first board ever created could receive the starter content.
    const seeded = INITIAL_ELEMENTS.map((el) => ({ ...el, id: uid('el'), version: 0 }));
    // Attach the starter arrows to the boxes they connect so they follow them.
    for (const el of seeded) {
      if ((el.kind !== 'arrow' && el.kind !== 'line') || !el.points) continue;
      const [x1, y1, x2, y2] = el.points as [number, number, number, number];
      const start = bindableAt(seeded, { x: x1, y: y1 }, 14);
      const end = bindableAt(seeded, { x: x2, y: y2 }, 14);
      el.pointsAbsolute = true;
      if (start) el.startBinding = { elementId: start.id };
      if (end) el.endBinding = { elementId: end.id };
    }
    seeded.forEach((el) => store.addElement(el));
    store.commitHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id, board?.elements.length]);

  // ---- keyboard shortcuts ------------------------------------------------------
  useHotkeys(
    [
      { key: 'k', meta: true, skipWhenTyping: true, handler: () => setCommandPalette(true) },
      { key: 'k', ctrl: true, skipWhenTyping: true, handler: () => setCommandPalette(true) },
      ...Object.entries(TOOL_KEYS).map(([key, tool]) => ({
        key,
        skipWhenTyping: true,
        handler: () => setTool(tool),
      })),
      { key: 'g', skipWhenTyping: true, handler: () => useCanvasStore.getState().toggleGrid() },
      { key: 'z', meta: true, skipWhenTyping: true, handler: () => useBoardStore.getState().undo() },
      { key: 'z', ctrl: true, skipWhenTyping: true, handler: () => useBoardStore.getState().undo() },
      { key: 'z', meta: true, shift: true, skipWhenTyping: true, handler: () => useBoardStore.getState().redo() },
      { key: 'z', ctrl: true, shift: true, skipWhenTyping: true, handler: () => useBoardStore.getState().redo() },
      {
        key: 'delete',
        skipWhenTyping: true,
        handler: () => {
          const ids = useBoardStore.getState().selectedIds;
          if (ids.length) useBoardStore.getState().removeElements(ids);
        },
      },
      {
        key: 'backspace',
        skipWhenTyping: true,
        handler: () => {
          const ids = useBoardStore.getState().selectedIds;
          if (ids.length) useBoardStore.getState().removeElements(ids);
        },
      },
      {
        key: 'escape',
        handler: () => {
          const currentTool = useToolStore.getState().tool;
          // Escape switches back to select tool unless already on select
          if (currentTool !== 'select') {
            setTool('select');
          }
          // Also close modals/panels
          useUIStore.getState().setCommandPalette(false);
          useUIStore.getState().setVersionTimeline(false);
          useUIStore.getState().setActiveComment(null);
          useUIStore.getState().setZen(false);
          useUIStore.getState().setFollowing(null);
        },
      },
      { key: 'a', shift: true, skipWhenTyping: true, handler: () => document.getElementById('arrange-button')?.click() },
      // Copy/Paste/Duplicate
      {
        key: 'c',
        meta: true,
        skipWhenTyping: true,
        handler: () => {
          const ids = useBoardStore.getState().selectedIds;
          if (ids.length) useBoardStore.getState().copyElements(ids);
        },
      },
      {
        key: 'c',
        ctrl: true,
        skipWhenTyping: true,
        handler: () => {
          const ids = useBoardStore.getState().selectedIds;
          if (ids.length) useBoardStore.getState().copyElements(ids);
        },
      },
      {
        key: 'v',
        meta: true,
        skipWhenTyping: true,
        handler: () => useBoardStore.getState().pasteElements(),
      },
      {
        key: 'v',
        ctrl: true,
        skipWhenTyping: true,
        handler: () => useBoardStore.getState().pasteElements(),
      },
      {
        key: 'd',
        meta: true,
        skipWhenTyping: true,
        handler: () => {
          const ids = useBoardStore.getState().selectedIds;
          if (ids.length) useBoardStore.getState().duplicateElements(ids);
        },
      },
      {
        key: 'd',
        ctrl: true,
        skipWhenTyping: true,
        handler: () => {
          const ids = useBoardStore.getState().selectedIds;
          if (ids.length) useBoardStore.getState().duplicateElements(ids);
        },
      },
      // Select All
      {
        key: 'a',
        meta: true,
        skipWhenTyping: true,
        handler: () => {
          const board = useBoardStore.getState().board;
          if (board) {
            const ids = board.elements.map((el) => el.id);
            useBoardStore.getState().select(ids);
          }
        },
      },
      {
        key: 'a',
        ctrl: true,
        skipWhenTyping: true,
        handler: () => {
          const board = useBoardStore.getState().board;
          if (board) {
            const ids = board.elements.map((el) => el.id);
            useBoardStore.getState().select(ids);
          }
        },
      },
      // Zoom presets
      { key: '1', skipWhenTyping: true, handler: () => zoomAroundCenter(1) },
      { key: '2', skipWhenTyping: true, handler: () => zoomAroundCenter(0.5) },
      { key: '3', skipWhenTyping: true, handler: () => zoomAroundCenter(2) },
      { key: '0', skipWhenTyping: true, handler: fitToContent },
      // Zoom in/out with keyboard (animated, around the screen center)
      ...(['meta', 'ctrl'] as const).flatMap((mod) => [
        { key: '=', [mod]: true, skipWhenTyping: true, handler: () => zoomAroundCenter(useCanvasStore.getState().viewport.scale * 1.25) },
        { key: '-', [mod]: true, skipWhenTyping: true, handler: () => zoomAroundCenter(useCanvasStore.getState().viewport.scale / 1.25) },
        { key: '.', [mod]: true, skipWhenTyping: true, handler: () => useUIStore.getState().setZen(!useUIStore.getState().zen) },
        { key: ']', [mod]: true, skipWhenTyping: true, handler: () => useBoardStore.getState().reorder(useBoardStore.getState().selectedIds, 'front') },
        { key: '[', [mod]: true, skipWhenTyping: true, handler: () => useBoardStore.getState().reorder(useBoardStore.getState().selectedIds, 'back') },
        { key: 'y', [mod]: true, skipWhenTyping: true, handler: () => useBoardStore.getState().redo() },
        {
          key: 'l',
          [mod]: true,
          skipWhenTyping: true,
          handler: () => {
            const { selectedIds, board, setLocked } = useBoardStore.getState();
            if (!selectedIds.length || !board) return;
            const allLocked = board.elements.filter((el) => selectedIds.includes(el.id)).every((el) => el.locked);
            setLocked(selectedIds, !allLocked);
          },
        },
      ]),
      { key: '!', shift: true, skipWhenTyping: true, handler: fitToContent },
      { key: 'm', skipWhenTyping: true, handler: () => useUIStore.getState().setMinimapVisible(!useUIStore.getState().minimapVisible) },
      { key: '?', shift: true, skipWhenTyping: true, handler: () => window.dispatchEvent(new Event('vb:open-help')) },
    ],
    [boardId, setTool, setCommandPalette],
  );

  const panelOpen = useUIStore((s) => s.rightPanelOpen);
  const zen = useUIStore((s) => s.zen);
  const tool = useToolStore((s) => s.tool);

  return (
    <div className="relative h-screen overflow-clip bg-board text-ink">
      {/* Full-bleed canvas; every control floats above it. */}
      <div className="absolute inset-0">
        <CanvasStage />
      </div>
      <CursorsOverlay />
      <ElementOverlays />
      <DiffOverlay />
      <LaserOverlay />
      <SelectionToolbar />
      <FollowFrame />

      {!zen && (
        <>
          <TopBar onOpenSettings={() => setSettingsOpen(true)} />
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex flex-col items-center gap-2 px-4">
            <AnimatePresence>{tool === 'pen' && <PenToolbar key="pen" />}</AnimatePresence>
            <Toolbar />
          </div>
          <div className="pointer-events-none absolute bottom-4 left-4 z-30 hidden md:block">
            <StatusBar />
          </div>
          <div className="pointer-events-none absolute bottom-4 right-4 z-30 hidden lg:block">
            <NavigationDock />
          </div>
          <AnimatePresence>{panelOpen && <RightPanel />}</AnimatePresence>
        </>
      )}
      {zen && (
        <button
          onClick={() => useUIStore.getState().setZen(false)}
          className="glass absolute right-4 top-4 z-30 flex h-9 items-center gap-2 rounded-full px-3.5 text-[12px] font-medium text-ink-2 transition-colors hover:text-ink"
        >
          <EyeOff size={14} /> Exit zen <kbd className="font-mono text-[10px] text-ink-3">Esc</kbd>
        </button>
      )}

      <ConnectionBanner />
      <ArrangeBadge />
      <ArrangeAnalyzing />
      <VersionTimeline />

      {loading && (
        <div className="absolute inset-0 z-40 bg-paper">
          <CanvasSkeleton />
        </div>
      )}

      <CommandPalette />
      <DocumentPreview />
      <OnboardingOverlay />
      <HelpButton />
      <BoardSettingsModal boardId={boardId} open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <button
        id="arrange-trigger"
        onClick={() => {
          useSuggestionStore.getState().showPanel();
          setRightPanelTab('suggestions');
        }}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

/** Colored frame + label while following a collaborator's pointer. */
function FollowFrame() {
  const followingId = useUIStore((s) => s.followingId);
  const user = usePresenceStore((s) => s.users.find((u) => u.id === followingId));
  if (!followingId || !user) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-40" style={{ boxShadow: `inset 0 0 0 3px ${user.color}` }}>
      <div className="absolute left-1/2 top-3 -translate-x-1/2">
        <button
          className="pointer-events-auto flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg"
          style={{ background: user.color }}
          onClick={() => useUIStore.getState().setFollowing(null)}
        >
          Following {user.name}
          <span className="rounded-full bg-white/25 px-1.5 font-mono text-[10px]">Esc to stop</span>
        </button>
      </div>
    </div>
  );
}
