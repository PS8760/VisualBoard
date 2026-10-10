import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
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
import { attachRealtimeListeners } from '../../services/realtime';
import { INITIAL_ELEMENTS } from './boardSeeds';
import BoardSettingsModal from './BoardSettingsModal';
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
  const setRightPanel = useUIStore((s) => s.setRightPanel);
  const setRightPanelTab = useUIStore((s) => s.setRightPanelTab);

  // keep the header in sync when the settings modal renames the board
  useEffect(() => {
    const onRenamed = () => {
      void load(boardId);
    };
    window.addEventListener('vb:board-renamed', onRenamed);
    return () => window.removeEventListener('vb:board-renamed', onRenamed);
  }, [boardId, load]);

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
        name: authUser?.name ?? 'Pranav',
        color: authUser?.color ?? '#d9480f',
      });
    }
  }, []);

  // ---- realtime -------------------------------------------------------------
  useEffect(() => {
    usePresenceStore.getState().connect(boardId);
    const detach = attachRealtimeListeners();
    return () => {
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
    INITIAL_ELEMENTS.forEach((el) => store.addElement(el));
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
      { key: '1', skipWhenTyping: true, handler: () => useCanvasStore.getState().zoomTo(1) },
      { key: '2', skipWhenTyping: true, handler: () => useCanvasStore.getState().zoomTo(0.5) },
      { key: '3', skipWhenTyping: true, handler: () => useCanvasStore.getState().zoomTo(2) },
      { key: '0', skipWhenTyping: true, handler: () => useCanvasStore.getState().resetView() },
      // Zoom in/out with keyboard
      { key: '=', meta: true, skipWhenTyping: true, handler: () => useCanvasStore.getState().zoomBy(1.2) },
      { key: '=', ctrl: true, skipWhenTyping: true, handler: () => useCanvasStore.getState().zoomBy(1.2) },
      { key: '-', meta: true, skipWhenTyping: true, handler: () => useCanvasStore.getState().zoomBy(0.8) },
      { key: '-', ctrl: true, skipWhenTyping: true, handler: () => useCanvasStore.getState().zoomBy(0.8) },
    ],
    [boardId, setTool, setCommandPalette],
  );

  const panelOpen = useUIStore((s) => s.rightPanelOpen);
  const tool = useToolStore((s) => s.tool);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-paper text-ink">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="relative flex flex-1 overflow-hidden">
        <Toolbar />
        {tool === 'pen' && <PenToolbar />}
        <div className="relative flex-1 overflow-hidden">
          <CanvasStage />
          <CursorsOverlay />
          <ElementOverlays />
          <ConnectionBanner />
          <ArrangeBadge />
          <ArrangeAnalyzing />
          <VersionTimeline />

          {loading && (
            <div className="absolute inset-0 z-30 bg-paper">
              <CanvasSkeleton />
            </div>
          )}

          <div className="absolute right-0 top-1/2 z-20 -translate-y-1/2">
            {!panelOpen && (
              <button
                onClick={() => setRightPanel(true)}
                className="flex h-12 w-5 items-center justify-center rounded-l-md border border-r-0 border-line-2 bg-paper text-ink-3 shadow-xs transition-colors hover:text-ink"
                aria-label="Open panel"
              >
                <ChevronLeft size={12} className="-scale-x-100" />
              </button>
            )}
          </div>
        </div>

        {panelOpen && <RightPanel />}
      </div>
      <StatusBar />
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