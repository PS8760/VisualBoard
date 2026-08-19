import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, Lock, User as UserIcon, ArrowRight } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/useAuthStore';
import { cn } from '../utils';

interface Strength {
  label: string;
  score: number;
  tone: 'danger' | 'warning' | 'success';
}

function strengthOf(pw: string): Strength {
  if (!pw) return { label: '', score: 0, tone: 'danger' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 6) return { label: 'Too short', score: 1, tone: 'danger' };
  if (score <= 2) return { label: 'Weak', score: 2, tone: 'danger' };
  if (score <= 3) return { label: 'Fair', score: 3, tone: 'warning' };
  return { label: 'Strong', score: 5, tone: 'success' };
}

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = strengthOf(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) {
      setError('Passwords do not match');
      return;
    }
    if (strength.score < 2) {
      setError('Password is too weak');
      return;
    }
    setLoading(true);
    setError(null);
    const ok = await register(name, email, password);
    setLoading(false);
    if (ok) {
      toast.success('Account created — welcome to VisualBoard');
      navigate('/dashboard');
    } else {
      const msg = useAuthStore.getState().error;
      setError(msg ?? 'Registration failed');
      toast.error(msg ?? 'Registration failed');
    }
  };

  const input =
    'h-10 w-full rounded-sm border border-line-2 bg-paper px-3 pl-9 text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 focus:border-ink focus:outline-none';

  return (
    <AuthShell sideNote="REGISTER — NEW BOARD">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center gap-1 font-mono text-[11px] text-ink-3">
          <span className="text-ink-2">/account</span>
          <ArrowRight size={11} />
          <span>register</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-2">One account. Every board you'll ever draw.</p>

        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Name
            </label>
            <div className="relative">
              <UserIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                id="name"
                type="text"
                required
                autoComplete="name"
                placeholder="Ada Lovelace"
                className={input}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-email" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Email
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                id="reg-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="reg-password" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                id="reg-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="8+ characters"
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {password && (
              <div className="mt-2">
                <div className="flex gap-1" aria-hidden="true">
                  {[1, 2, 3, 4].map((bar) => (
                    <span
                      key={bar}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors duration-200',
                        bar <= Math.ceil(strength.score / 1.25)
                          ? strength.tone === 'danger'
                            ? 'bg-danger'
                            : strength.tone === 'warning'
                              ? 'bg-warning'
                              : 'bg-success'
                          : 'bg-line-2',
                      )}
                    />
                  ))}
                </div>
                <p className={cn('mt-1.5 font-mono text-[10px] uppercase tracking-wide', strength.tone === 'danger' && 'text-danger', strength.tone === 'warning' && 'text-warning', strength.tone === 'success' && 'text-success')}>
                  {strength.label}
                  {strength.label === 'Strong' && <span className="ml-1 text-ink-3">/ password ok</span>}
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Confirm password
            </label>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                id="confirm"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Repeat password"
                className={cn(input, mismatch && 'border-danger')}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            {mismatch && (
              <p className="mt-1.5 text-[11.5px] text-danger">Passwords do not match</p>
            )}
          </div>

          {error && (
            <p className="rounded-sm border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>

        <p className="mt-7 text-center text-[13px] text-ink-2">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent transition-colors hover:text-accent-2">
            Login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}