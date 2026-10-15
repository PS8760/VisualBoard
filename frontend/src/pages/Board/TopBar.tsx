import { useState } from 'react';
import {
  Share2, History, Settings, Command, Check, CloudOff, Loader2, Globe, AlertCircle, PanelRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { LogoMark } from '../../components/ui/Logo';
import { Tooltip } from '../../components/ui/Tooltip';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { cn } from '../../utils';
import { useBoardStore } from '../../stores/useBoardStore';
import { useUIStore } from '../../stores/useUIStore';
import { usePresenceStore } from '../../stores/usePresenceStore';
import { useAuthStore } from '../../stores/useAuthStore';

function SaveIndicator() {
  const saveStatus = useBoardStore((s) => s.saveStatus);
  const isDemo = useBoardStore((s) => s.isDemo);

  if (isDemo) {
    return (
      <span className="hidden items-center gap-1.5 font-mono text-[10.5px] text-ink-3 sm:inline-flex">
        <CloudOff size={11} />
        preview data
      </span>
    );
  }

  return (
    <span className="hidden items-center gap-1.5 font-mono text-[10.5px] sm:inline-flex">
      {saveStatus.state === 'saving' ? (
        <>
          <Loader2 size={11} className="animate-spin text-ink-3" />
          <span className="text-ink-3">saving…</span>
        </>
      ) : saveStatus.state === 'offline' ? (
        <>
          <CloudOff size={11} className="text-warning" />
          <span className="text-warning">{saveStatus.message ?? 'offline'}</span>
        </>
      ) : saveStatus.state === 'error' ? (
        <>
          <AlertCircle size={11} className="text-warning" />
          <span className="text-warning">{saveStatus.message ?? 'save failed'}</span>
        </>
      ) : (
        <>
          <Check size={11} className="text-success" />
          <span className="text-ink-3">saved</span>
        </>
      )}
    </span>
  );
}

export default function TopBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const board = useBoardStore((s) => s.board);
  const setTitle = useBoardStore((s) => s.setTitle);
  const setCommandPalette = useUIStore((s) => s.setCommandPalette);
  const setVersionTimeline = useUIStore((s) => s.setVersionTimeline);
  const panelOpen = useUIStore((s) => s.rightPanelOpen);
  const followingId = useUIStore((s) => s.followingId);
  const users = usePresenceStore((s) => s.users);
  const mode = usePresenceStore((s) => s.mode);
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);

  const share = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast.success('Share link copied', { description: 'Anyone with the link can open this board.' });
  };

  // One avatar per person (several tabs of the same user share a name).
  const remotes = users.filter((u) => !u.isLocal);
  const people = [...users.filter((u) => u.isLocal), ...remotes.filter((u, i) => remotes.findIndex((x) => x.name === u.name) === i)];

  const follow = (id: string, name: string) => {
    const ui = useUIStore.getState();
    if (ui.followingId === id) {
      ui.setFollowing(null);
      return;
    }
    ui.setFollowing(id);
    toast(`Following ${name}`, { id: 'vb-follow', description: 'Your view follows their pointer. Move or scroll to stop.' });
  };

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
      <div className="glass pointer-events-auto flex min-w-0 items-center gap-2 rounded-2xl py-1.5 pl-2 pr-3">
        <Link to="/dashboard" className="island-btn h-8 w-8 shrink-0" aria-label="Back to VisualBoard home">
          <LogoMark size={18} />
        </Link>
        <span className="h-5 w-px shrink-0 bg-line-2" aria-hidden="true" />
        {editing ? (
          <input
            autoFocus
            defaultValue={board?.title ?? 'Untitled board'}
            onBlur={(e) => {
              setTitle(e.target.value.trim() || 'Untitled board');
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="h-8 w-52 rounded-lg border border-line-2 bg-paper px-2 text-[13px] font-semibold text-ink focus:border-ink focus:outline-none"
            aria-label="Board name"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="max-w-[240px] truncate rounded-lg px-1.5 py-1 text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper-3"
            title="Rename board"
          >
            {board?.title ?? 'Untitled board'}
          </button>
        )}
        <SaveIndicator />
      </div>

      <div className="glass pointer-events-auto flex items-center gap-1 rounded-2xl p-1.5">
        {mode === 'simulated' && (
          <Tooltip label="Live collaboration demo">
            <span className="mr-1 hidden items-center gap-1 rounded-full border border-warning/25 bg-warning-soft px-2 py-0.5 font-mono text-[9.5px] font-medium text-warning sm:inline-flex">
              <Globe size={9} />
              simulated
            </span>
          </Tooltip>
        )}
        <div data-tour="presence" className="flex -space-x-1.5 px-1" aria-label={`${people.length} people online`}>
          {people.slice(0, 5).map((u) => {
            const following = followingId === u.id;
            return (
              <Tooltip key={u.id} label={u.isLocal ? `${u.name} (you)` : following ? `Stop following ${u.name}` : `Follow ${u.name}`} className="inline-flex">
                <button
                  onClick={() => !u.isLocal && follow(u.id, u.name)}
                  disabled={u.isLocal}
                  aria-label={u.isLocal ? `${u.name} (you)` : `Follow ${u.name}`}
                  aria-pressed={following}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full border-2 border-paper text-[10px] font-semibold text-white transition-transform',
                    !u.isLocal && 'hover:z-10 hover:scale-110',
                    following && 'z-10 ring-2 ring-offset-2 ring-offset-paper',
                  )}
                  style={{ background: u.color, ...(following ? { ['--tw-ring-color' as string]: u.color } : {}) }}
                >
                  {u.name.slice(0, 1).toUpperCase()}
                </button>
              </Tooltip>
            );
          })}
          {people.length > 5 && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-paper bg-paper-3 text-[10px] font-semibold text-ink-2">
              +{people.length - 5}
            </span>
          )}
        </div>
        <span className="mx-1 h-5 w-px bg-line-2" aria-hidden="true" />

        <Tooltip label={panelOpen ? 'Hide panel' : 'Inspector, comments & files'}>
          <button
            onClick={() => useUIStore.getState().setRightPanel(!panelOpen)}
            className={cn('island-btn', panelOpen && 'bg-paper-3 text-ink')}
            aria-label={panelOpen ? 'Hide panel' : 'Open panel'}
            data-tour={panelOpen ? undefined : 'panel'}
          >
            <PanelRight size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Version history">
          <button onClick={() => setVersionTimeline(true)} className="island-btn" aria-label="Open version history" data-tour="history">
            <History size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Command palette" shortcut={['⌘', 'K']}>
          <button onClick={() => setCommandPalette(true)} className="island-btn" aria-label="Open command palette" data-tour="commands">
            <Command size={16} />
          </button>
        </Tooltip>
        <Tooltip label="Board settings">
          <button onClick={onOpenSettings} className="island-btn" aria-label="Board settings">
            <Settings size={16} />
          </button>
        </Tooltip>
        <ThemeToggle />
        <button
          onClick={share}
          data-tour="share"
          className="ml-1 flex h-9 items-center gap-1.5 rounded-[0.65rem] bg-accent px-3.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-2"
        >
          <Share2 size={14} />
          <span className="hidden sm:inline">Share</span>
        </button>
        <span className="sr-only">{user?.name ?? 'Guest'}</span>
      </div>
    </header>
  );
}
