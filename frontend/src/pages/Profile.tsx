import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';
import AccountHeader from '../components/AccountHeader';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/useAuthStore';
import * as userApi from '../api/user.api';
import { cn } from '../utils';
import type { User } from '../types';

export default function Profile() {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const setCurrentUser = useAuthStore((s) => s.setCurrentUser);

  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token || !authUser) {
      navigate('/login', { replace: true });
      return;
    }
    void userApi.fetchMe().then((me) => {
      if (me) {
        setUser(me);
        setName(me.name);
      }
    });
  }, [token, authUser, navigate]);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Name must be at least 2 characters');
      return;
    }
    setSavingName(true);
    const res = await userApi.updateProfile({ name: trimmed });
    setSavingName(false);
    if (res.ok && res.user) {
      setUser((prev) => (prev ? { ...prev, name: trimmed, initials: res.user!.initials } : prev));
      setCurrentUser({ name: trimmed, initials: res.user!.initials });
      toast.success('Profile updated');
    } else {
      toast.error(res.message ?? 'Could not update profile');
    }
  };

  const pickAvatar = (file: File | undefined) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      toast.error('Avatar must be a PNG, JPEG, WebP or GIF image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be smaller than 5 MB');
      return;
    }
    setSavingAvatar(true);
    void userApi.uploadAvatar(file).then((res) => {
      setSavingAvatar(false);
      if (res.ok && res.avatar) {
        setUser((prev) => (prev ? { ...prev, avatar: res.avatar! } : prev));
        setCurrentUser({ avatar: res.avatar! });
        toast.success('Avatar updated');
      } else {
        toast.error(res.message ?? 'Avatar upload failed');
      }
    });
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    setSavingPassword(true);
    const res = await userApi.changePassword(currentPassword, newPassword);
    setSavingPassword(false);
    if (res.ok) {
      toast.success('Password changed');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      toast.error(res.message ?? 'Password change failed');
    }
  };

  const input =
    'h-10 w-full rounded-sm border border-line-2 bg-paper px-3 text-[13.5px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none';

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <AccountHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-ink-2">Your account details, avatar and security settings.</p>

        <section className="mt-8 rounded-lg border border-line-2 bg-paper p-5 shadow-xs">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Appearance</h2>

          <div className="mt-4 flex items-center gap-4">
            {user?.avatar ? (
              <img src={user.avatar} alt="Current avatar" className="h-16 w-16 rounded-full border border-line-2 object-cover" />
            ) : (
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white"
                style={{ background: user?.color ?? '#3a2c16' }}
              >
                {user?.initials ?? '?'}
              </span>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => pickAvatar(e.target.files?.[0])}
                aria-label="Upload avatar"
              />
              <Button
                variant="secondary"
                size="sm"
                loading={savingAvatar}
                onClick={() => fileRef.current?.click()}
              >
                <Camera size={13} /> Change avatar
              </Button>
              <p className="mt-1.5 text-[11px] text-ink-3">PNG, JPEG or WebP up to 5 MB.</p>
            </div>
          </div>

          <form onSubmit={saveName} className="mt-5 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Display name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                className={input}
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Email
              </label>
              <input id="email" value={user?.email ?? ''} disabled className={cn(input, 'cursor-not-allowed bg-paper-2 text-ink-3')} />
            </div>
            <Button type="submit" size="sm" loading={savingName}>
              <Save size={13} /> Save name
            </Button>
          </form>
        </section>

        <section className="mt-6 rounded-lg border border-line-2 bg-paper p-5 shadow-xs">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-3">Security</h2>
          <p className="mt-1 text-[12px] text-ink-3">Set a new password. You will need your current one.</p>

          <form onSubmit={savePassword} className="mt-4 space-y-4">
            <div>
              <label htmlFor="current" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                Current password
              </label>
              <input
                id="current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={input}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="new" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                  New password
                </label>
                <input
                  id="new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  className={input}
                />
              </div>
              <div>
                <label htmlFor="confirm" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
                  Confirm new password
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className={input}
                />
              </div>
            </div>
            <Button type="submit" size="sm" variant="secondary" loading={savingPassword}>
              <KeyRound size={13} /> Change password
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
}