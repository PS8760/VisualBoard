import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Plus, Search, Trash2, ArrowUpRight, FileText, MessageSquare, Users, LogOut, UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { LogoMark } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { useAuthStore } from '../stores/useAuthStore';
import * as boardApi from '../api/board.api';
import { timeAgo, cn } from '../utils';

const ROLE_LABEL: Record<string, string> = { owner: 'owner', editor: 'editor', viewer: 'viewer' };

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);

  const [boards, setBoards] = useState<boardApi.BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const load = useCallback(async () => {
    const list = await boardApi.listBoards();
    setBoards(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token || !user) {
      navigate('/login', { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetching on mount
    void load();
  }, [token, user, navigate, load]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter((b) => b.title.toLowerCase().includes(q));
  }, [boards, filter]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const name = title.trim();
    if (!name) return;
    setCreating(true);
    const board = await boardApi.createBoard(name, description.trim() || undefined);
    setCreating(false);
    if (board) {
      toast.success('Project created');
      navigate(`/board/${board.id}`);
    } else {
      toast.error('Could not create the project');
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? Elements, comments and history will be removed permanently.`)) return;
    const res = await boardApi.deleteBoard(id);
    if (res.ok) {
      toast.success('Project deleted');
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } else {
      toast.error(res.message ?? 'Could not delete the project');
    }
  };

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-paper px-4 md:px-6">
        <div className="flex items-center gap-2.5">
          <Link to="/" aria-label="VisualBoard home">
            <LogoMark size={20} />
          </Link>
          <span className="h-4 w-px bg-line" aria-hidden="true" />
          <span className="font-mono text-[11px] text-ink-3">/dashboard</span>
        </div>

        <div className="relative flex items-center gap-2">
          <ThemeToggle size="sm" />
          {user && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-sm border border-line-2 bg-paper py-1 pl-1 pr-2.5 transition-colors hover:border-line-3"
              aria-label="Account menu"
            >
              {user.avatar ? (
                <img src={user.avatar} alt="" className="h-7 w-7 rounded-full border border-line-2 object-cover" />
              ) : (
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: user.color }}
                >
                  {user.initials}
                </span>
              )}
              <span className="max-w-[140px] truncate text-[12.5px] font-medium">{user.name}</span>
            </button>
          )}

          {menuOpen && user && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
              <div className="absolute right-0 top-11 z-40 w-48 rounded-md border border-line-2 bg-paper p-1 shadow-lg">
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 rounded-sm px-2.5 py-2 text-[12.5px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink"
                >
                  <UserRound size={13} /> Profile
                </Link>
                <button
                  onClick={signOut}
                  className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-[12.5px] text-danger transition-colors hover:bg-danger-soft"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Your projects
          <span className="ml-2 font-mono text-[11px] font-normal text-ink-3">({boards.length})</span>
        </h1>
        <p className="mt-1 text-sm text-ink-2">Create a board, invite teammates, and sketch living architecture.</p>

        <form
          onSubmit={create}
          className="mt-6 rounded-lg border border-line-2 bg-paper p-4 shadow-xs"
          aria-label="Create a new project"
        >
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project name — e.g. Checkout service"
              required
              maxLength={120}
              className="h-10 flex-1 rounded-sm border border-line-2 bg-paper px-3 text-[13.5px] placeholder:text-ink-3 focus:border-ink focus:outline-none"
              aria-label="Project name"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description (optional)"
              maxLength={1000}
              className="h-10 flex-1 rounded-sm border border-line-2 bg-paper px-3 text-[13.5px] placeholder:text-ink-3 focus:border-ink focus:outline-none"
              aria-label="Project description"
            />
            <Button type="submit" loading={creating} className="h-10 shrink-0">
              <Plus size={14} /> Create
            </Button>
          </div>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3">
          <label className="relative block w-full max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter projects…"
              className="h-9 w-full rounded-sm border border-line-2 bg-paper pl-9 pr-3 text-[13px] placeholder:text-ink-3 focus:border-ink focus:outline-none"
              aria-label="Filter projects"
            />
          </label>
        </div>

        {loading ? (
          <div className="mt-8 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-md border border-line bg-paper-2/60" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-2 py-10 text-center">
            <LayoutGrid size={28} className="text-ink-3" />
            <p className="text-[13.5px] font-medium text-ink-2">
              {boards.length === 0 ? 'No projects yet' : 'No projects match the filter'}
            </p>
            <p className="max-w-sm text-[12px] leading-relaxed text-ink-3">
              {boards.length === 0
                ? 'Create your first whiteboard above — it opens with a shared canvas you can sketch on right away.'
                : 'Try a different search term.'}
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-2.5">
            {filtered.map((b) => (
              <div
                key={b.id}
                className="group flex items-center gap-4 rounded-md border border-line-2 bg-paper p-3.5 shadow-xs transition-colors hover:border-line-3"
              >
                <Link to={`/board/${b.id}`} className="min-w-0 flex-1" aria-label={`Open ${b.title}`}>
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold text-ink">{b.title}</p>
                    <span
                      className={cn(
                        'shrink-0 rounded-sm px-1.5 py-0.5 font-mono text-[8.5px] font-medium uppercase tracking-wide',
                        b.role === 'owner' && 'bg-accent-soft text-accent',
                        b.role === 'editor' && 'bg-paper-2 text-ink-2',
                        b.role === 'viewer' && 'bg-paper-2 text-ink-3',
                      )}
                    >
                      {ROLE_LABEL[b.role]}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-ink-3">
                    {b.description || 'No description'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-3 font-mono text-[9.5px] text-ink-3">
                    <span className="flex items-center gap-1">
                      <FileText size={10} /> {b.elementCount} elements
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare size={10} /> {b.commentCount} comments
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={10} /> members
                    </span>
                    <span>updated {timeAgo(b.updatedAt)}</span>
                  </div>
                </Link>

                <Link
                  to={`/board/${b.id}`}
                  className="hidden items-center gap-1.5 rounded-sm border border-line-2 px-3 py-1.5 text-[12px] font-medium text-ink-2 transition-colors hover:border-line-3 hover:text-ink sm:flex"
                >
                  Open <ArrowUpRight size={12} />
                </Link>

                {(b.role === 'owner' || b.role === 'editor') && (
                  <button
                    onClick={() => remove(b.id, b.title)}
                    className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                    aria-label={`Delete ${b.title}`}
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}