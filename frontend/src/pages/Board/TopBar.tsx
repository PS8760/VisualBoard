import { useState } from 'react';
import {
  Share2, History, Settings, Command, Check, CloudOff, Loader2, Globe, AlertCircle,
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
  const users = usePresenceStore((s) => s.users);
  const mode = usePresenceStore((s) => s.mode);
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);

  const share = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText(url).catch(() => {});
    toast.success('Share link copied', { description: 'Anyone with the link can open this board.' });
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-line bg-paper px-3 md:px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link to="/" className="shrink-0" aria-label="Back to VisualBoard home">
          <LogoMark size={18} />
        </Link>
        <span className="h-4 w-px shrink-0 bg-line" aria-hidden="true" />
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
            className="h-7 w-52 rounded-sm border border-line-2 bg-paper px-2 text-[13px] font-medium text-ink focus:border-ink focus:outline-none"
            aria-label="Board name"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="max-w-[220px] truncate rounded-sm px-1.5 py-1 text-[13px] font-medium text-ink transition-colors hover:bg-paper-2"
            title="Rename board"
          >
            {board?.title ?? 'Untitled board'}
          </button>
        )}
        <SaveIndicator />
      </div>

      <div className="flex items-center gap-1">
        <Tooltip label="Command palette" shortcut={['⌘', 'K']}>
          <button
            onClick={() => setCommandPalette(true)}
            className="flex h-8 items-center gap-1.5 rounded-sm border border-line-2 bg-paper px-2.5 text-[11.5px] font-medium text-ink-2 transition-colors hover:border-line-3 hover:text-ink"
            aria-label="Open command palette"
            data-tour="commands"
          >
            <Command size={13} />
            <span className="hidden md:inline">Commands</span>
            <kbd className="hidden rounded-[3px] border border-line-2 bg-paper-2 px-1 font-mono text-[9.5px] text-ink-3 md:inline">⌘K</kbd>
          </button>
        </Tooltip>

        <Tooltip label="Version history">
          <button
            onClick={() => setVersionTimeline(true)}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            aria-label="Open version history"
            data-tour="history"
          >
            <History size={15} />
          </button>
        </Tooltip>

        <Tooltip label="Board settings">
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
            aria-label="Board settings"
          >
            <Settings size={15} />
          </button>
        </Tooltip>

        <ThemeToggle size="sm" />

        <span className="mx-1 h-4 w-px bg-line" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          {mode === 'simulated' && (
            <Tooltip label="Live collaboration demo">
              <span className="hidden items-center gap-1 rounded-full border border-warning/25 bg-warning-soft px-2 py-0.5 font-mono text-[9.5px] font-medium text-warning sm:inline-flex">
                <Globe size={9} />
                simulated
              </span>
            </Tooltip>
          )}
          <div data-tour="presence" className="flex -space-x-1.5" aria-label={`${users.length} people online`}>
            {users.slice(0, 4).map((u) => (
              <Tooltip key={u.id} label={u.name} className="inline-flex">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper text-[9px] font-semibold text-white"
                  style={{ background: u.color }}
                >
                  {u.name.slice(0, 1).toUpperCase()}
                </span>
              </Tooltip>
            ))}
            {users.length > 4 && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-paper bg-paper-2 text-[9px] font-semibold text-ink-2">
                +{users.length - 4}
              </span>
            )}
          </div>
          <span className={cn('hidden font-mono text-[10px] text-ink-3 lg:block')}>
            {user?.name ?? 'Guest'}
          </span>
        </div>

        <button
          onClick={share}
          data-tour="share"
          className="ml-2 flex h-8 items-center gap-1.5 rounded-sm bg-accent px-3 text-[12px] font-medium text-white transition-colors hover:bg-accent-2"
        >
          <Share2 size={13} />
          <span className="hidden sm:inline">Share</span>
        </button>
      </div>
    </header>
  );
}