import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Trash2, UserPlus, Search, Crown, Shield, Eye, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { cn } from '../../utils';
import * as boardApi from '../../api/board.api';
import * as userApi from '../../api/user.api';
import { useAuthStore } from '../../stores/useAuthStore';
import type { User } from '../../types';

interface Props {
  boardId: string;
  open: boolean;
  onClose: () => void;
}

const ROLE_META: Record<User['role'], { label: string; icon: typeof Crown }> = {
  owner: { label: 'owner', icon: Crown },
  editor: { label: 'editor', icon: Shield },
  viewer: { label: 'viewer', icon: Eye },
};

export default function BoardSettingsModal({ boardId, open, onClose }: Props) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<User['role']>('viewer');
  const [inviting, setInviting] = useState(false);

  const [query, setQuery] = useState('');
  const [queryResults, setQueryResults] = useState<userApi.SearchResult[]>([]);
  const [querying, setQuerying] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const board = await boardApi.fetchBoard(boardId);
    const m = await userApi.fetchBoardMembers(boardId);
    setLoading(false);
    if (board.ok && board.board) {
      setTitle(board.board.title);
      setDescription(board.board.description ?? '');
    }
    setMembers(m);
  }, [boardId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on open
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSaving(true);
    const res = await boardApi.updateBoard(boardId, {
      title: trimmed,
      description: description.trim() || null,
    });
    setSaving(false);
    if (res.ok) {
      toast.success('Board updated');
      onClose();
      window.dispatchEvent(new Event('vb:board-renamed'));
    } else {
      toast.error(res.message ?? 'Could not update the board');
    }
  };

  const pickSearchResult = async (email: string) => {
    setInviteEmail(email);
    setQuery('');
    setQueryResults([]);
  };

  const onSearchChange = (value: string) => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 3) {
      setQueryResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setQuerying(true);
      const results = await userApi.searchUsers(value.trim());
      setQueryResults(results);
      setQuerying(false);
    }, 250);
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const email = (inviteEmail || query).trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    const res = await userApi.inviteMember(boardId, email, inviteRole);
    setInviting(false);
    if (res.ok) {
      toast.success('Member invited', { description: email });
      setInviteEmail('');
      setQuery('');
      setQueryResults([]);
      const m = await userApi.fetchBoardMembers(boardId);
      setMembers(m);
    } else {
      toast.error(res.message ?? 'Could not invite this user');
    }
  };

  const changeRole = async (userId: string, role: User['role']) => {
    const res = await userApi.updateMemberRole(boardId, userId, role);
    if (res.ok) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, role } : m)));
    } else {
      toast.error(res.message ?? 'Could not change the role');
    }
  };

  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this board?`)) return;
    const res = await userApi.removeMember(boardId, userId);
    if (res.ok) {
      toast.success('Member removed');
      setMembers((prev) => prev.filter((m) => m.id !== userId));
    } else {
      toast.error(res.message ?? 'Could not remove the member');
    }
  };

  const destroy = async () => {
    if (!window.confirm('Delete this board permanently? This cannot be undone.')) return;
    const res = await boardApi.deleteBoard(boardId);
    if (res.ok) {
      toast.success('Board deleted');
      navigate('/dashboard');
    } else {
      toast.error(res.message ?? 'Could not delete the board');
    }
  };

  if (!open) return null;

  const me = members.find((m) => m.id === currentUser?.id);
  const canManage = me?.role === 'owner';

  const input =
    'h-9 w-full rounded-sm border border-line-2 bg-paper px-3 text-[13px] placeholder:text-ink-3 focus:border-ink focus:outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Board settings">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-line-2 bg-paper shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Board settings</h2>
            <p className="font-mono text-[10px] text-ink-3">manage project details & collaborators</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-paper-2 hover:text-ink"
            aria-label="Close settings"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={18} className="animate-spin text-ink-3" />
            </div>
          ) : (
            <>
              <form onSubmit={save} className="space-y-3">
                <div>
                  <label htmlFor="board-title" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                    Project name
                  </label>
                  <input
                    id="board-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    required
                    className={input}
                  />
                </div>
                <div>
                  <label htmlFor="board-desc" className="mb-1.5 block text-[12px] font-medium text-ink-2">
                    Description
                  </label>
                  <textarea
                    id="board-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={1000}
                    className={cn(input, 'h-auto resize-none py-2 leading-relaxed')}
                  />
                </div>
                <Button type="submit" size="sm" loading={saving}>
                  Save changes
                </Button>
              </form>

              <div>
                <h3 className="text-[12.5px] font-semibold text-ink">Members</h3>
                <p className="mt-0.5 text-[11px] text-ink-3">
                  {members.length} {members.length === 1 ? 'person' : 'people'} can open this board.
                </p>

                <ul className="mt-3 space-y-2">
                  {members.map((m) => {
                    const Meta = ROLE_META[m.role];
                    const isSelf = m.id === currentUser?.id;
                    return (
                      <li key={m.id} className="flex items-center gap-2.5 rounded-md border border-line bg-paper px-2.5 py-2">
                        {m.avatar ? (
                          <img src={m.avatar} alt="" className="h-7 w-7 rounded-full border border-line-2 object-cover" />
                        ) : (
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold text-white"
                            style={{ background: m.color }}
                          >
                            {m.initials}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium text-ink">
                            {m.name}
                            {isSelf && <span className="ml-1.5 text-[10px] text-ink-3">(you)</span>}
                          </p>
                          <p className="truncate font-mono text-[9.5px] text-ink-3">{m.email}</p>
                        </div>

                        {canManage && m.role !== 'owner' ? (
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(m.id, e.target.value as User['role'])}
                            className="h-7 rounded-sm border border-line-2 bg-paper px-1.5 text-[11px] text-ink-2 focus:border-ink focus:outline-none"
                            aria-label={`Role of ${m.name}`}
                          >
                            <option value="editor">editor</option>
                            <option value="viewer">viewer</option>
                          </select>
                        ) : (
                          <span className="flex items-center gap-1 rounded-sm bg-paper-2 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-3">
                            <Meta.icon size={9} /> {ROLE_META[m.role].label}
                          </span>
                        )}

                        {canManage && !isSelf && (
                          <button
                            onClick={() => remove(m.id, m.name)}
                            className="flex h-7 w-7 items-center justify-center rounded-sm text-ink-3 transition-colors hover:bg-danger-soft hover:text-danger"
                            aria-label={`Remove ${m.name}`}
                            title="Remove member"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {canManage && (
                <form onSubmit={invite} className="rounded-md border border-dashed border-line-2 p-3">
                  <h3 className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
                    <UserPlus size={13} /> Invite by email
                  </h3>
                  <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                      <input
                        value={inviteEmail || query}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="teammate@company.com"
                        required
                        className={cn(input, 'pl-9')}
                        aria-label="Email to invite"
                      />
                      {queryResults.length > 0 && (
                        <ul className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-sm border border-line-2 bg-paper shadow-lg">
                          {queryResults.map((r) => (
                            <li key={r.id}>
                              <button
                                type="button"
                                onClick={() => pickSearchResult(r.email)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-ink transition-colors hover:bg-paper-2"
                              >
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-paper-2 font-mono text-[9px] font-semibold text-ink-2">
                                  {r.name.slice(0, 1).toUpperCase()}
                                </span>
                                <span className="min-w-0">
                                  <span className="block truncate font-medium">{r.name}</span>
                                  <span className="block truncate font-mono text-[9.5px] text-ink-3">{r.email}</span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {querying && (
                        <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink-3" />
                      )}
                    </div>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as User['role'])}
                      className="h-9 rounded-sm border border-line-2 bg-paper px-1.5 text-[12px] text-ink-2 focus:border-ink focus:outline-none"
                      aria-label="Role to grant"
                    >
                      <option value="viewer">viewer</option>
                      <option value="editor">editor</option>
                    </select>
                    <Button type="submit" size="sm" loading={inviting} className="h-9">
                      Invite
                    </Button>
                  </div>
                </form>
              )}

              {canManage && (
                <div className="rounded-md border border-danger/25 bg-danger-soft/40 p-3.5">
                  <h3 className="text-[12.5px] font-semibold text-danger">Danger zone</h3>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-2">
                    Deleting this project removes its board, elements, comments, documents and version history for everyone.
                  </p>
                  <button
                    onClick={destroy}
                    className="mt-2.5 flex h-8 items-center gap-1.5 rounded-sm border border-danger/40 bg-paper px-3 text-[12px] font-medium text-danger transition-colors hover:bg-danger hover:text-white"
                  >
                    <Trash2 size={12} /> Delete board
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}