import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores/useAuthStore';

type Props = { children: React.ReactElement };

export default function ProtectedRoute({ children }: Props) {
  const isAuth = useAuthStore((s) => s.status === 'authenticated' && Boolean(s.user));
  if (!isAuth) return <Navigate to="/login" replace />;
  return children;
}
