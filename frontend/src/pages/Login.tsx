import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import AuthShell from './AuthShell';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../stores/useAuthStore';
import { useEffect } from 'react';

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

export default function Login() {
  const navigate = useNavigate();
  const { login, signInAsGuest } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      toast.success('Welcome back');
      navigate('/dashboard');
    } else {
      const msg = useAuthStore.getState().error;
      setError(msg ?? 'Login failed');
      toast.error(msg ?? 'Login failed');
    }
  };

  const guest = () => {
    signInAsGuest();
    toast.success('Exploring as guest');
    navigate('/board/demo-architecture');
  };

  useEffect(() => {
    // load Google Identity Services script for client-side id_token
    if (typeof window !== 'undefined' && !(window as unknown as { google?: unknown }).google) {
      const s = document.createElement('script');
      s.src = GSI_SCRIPT_URL;
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
  }, []);

  const input =
    'h-10 w-full rounded-sm border border-line-2 bg-paper px-3 pl-9 text-sm text-ink placeholder:text-ink-3 transition-colors duration-150 focus:border-ink focus:outline-none';

  return (
    <AuthShell sideNote="LOGIN — WELCOME BACK">
      <div className="w-full max-w-sm">
        <div className="mb-3 flex items-center gap-1 font-mono text-[11px] text-ink-3">
          <span className="text-ink-2">/account</span>
          <ArrowRight size={11} />
          <span>login</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1.5 text-sm text-ink-2">Pick up where your board left off.</p>

        <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-ink-2">
              Email
            </label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                id="email"
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
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-[12.5px] font-medium text-ink-2">
                Password
              </label>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info('Password reset link sent (demo)');
                }}
                className="text-[12px] text-ink-3 transition-colors hover:text-accent"
              >
                Forgot?
              </a>
            </div>
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-sm border border-danger/25 bg-danger-soft px-3 py-2 text-[12.5px] text-danger" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={loading}>
            Login
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-3">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <Button variant="secondary" size="lg" className="w-full" onClick={guest}>
          Continue as guest
        </Button>

        <p className="mt-7 text-center text-[13px] text-ink-2">
          New to VisualBoard?{' '}
          <Link to="/register" className="font-medium text-accent transition-colors hover:text-accent-2">
            Create an account
          </Link>
        </p>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Button variant="ghost" size="lg" onClick={() => {
          // open GitHub OAuth in popup
          const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID;
          const redirect = `${window.location.origin}/auth/github/callback`;
          const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=user:email&redirect_uri=${encodeURIComponent(redirect)}`;
          window.open(url, '_blank', 'width=500,height=700');
        }}>
          Continue with GitHub
        </Button>

        <Button variant="ghost" size="lg" onClick={() => {
          // open Google OAuth authorization URL in a popup (server-side code-exchange)
          const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
          const redirect = `${window.location.origin}/auth/google/callback`;
          const params = new URLSearchParams({
            client_id: String(clientId ?? ''),
            redirect_uri: redirect,
            response_type: 'code',
            scope: 'openid email profile',
            prompt: 'consent',
            access_type: 'offline',
          });
          const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
          window.open(url, '_blank', 'width=500,height=700');
        }}>
          Continue with Google
        </Button>
      </div>
    </AuthShell>
  );
}