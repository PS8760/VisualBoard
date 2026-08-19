import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { oauthExchange } from '../../api/auth.api';

export default function GithubCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      toast.error('No code returned from GitHub');
      navigate('/login');
      return;
    }

    oauthExchange('github', code)
      .then((res) => {
        if (res.success) {
          toast.success('Signed in with GitHub');
          navigate('/dashboard');
        } else {
          toast.error(res.message ?? 'GitHub sign-in failed');
          navigate('/login');
        }
      })
      .catch(() => {
        toast.error('GitHub sign-in failed');
        navigate('/login');
      });
  }, [navigate]);

  return <div className="min-h-screen flex items-center justify-center">Signing in with GitHub…</div>;
}