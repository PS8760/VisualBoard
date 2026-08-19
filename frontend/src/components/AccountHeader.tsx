import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, UserRound } from 'lucide-react';
import { LogoMark } from './ui/Logo';
import { useAuthStore } from '../stores/useAuthStore';

export default function AccountHeader() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [menuOpen, setMenuOpen] = useState(false);

  const signOut = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-paper px-4 md:px-6">
      <div className="flex items-center gap-2.5">
        <Link to="/" aria-label="VisualBoard home">
          <LogoMark size={20} />
        </Link>
        <span className="h-4 w-px bg-line" aria-hidden="true" />
        <Link to="/dashboard" className="font-mono text-[11px] text-ink-3 transition-colors hover:text-ink">
          /dashboard
        </Link>
      </div>

      <div className="relative flex items-center gap-2">
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
  );
}