import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './routes';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemeProvider } from './components/ThemeProvider';
import { useAuthStore } from './stores/useAuthStore';
import { useThemeStore } from './stores/useThemeStore';

function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const theme = useThemeStore((s) => s.theme);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    hydrate();
    const t = setTimeout(() => setBooting(false), 850);
    return () => clearTimeout(t);
  }, [hydrate]);

  return (
    <ErrorBoundary>
      <ThemeProvider />
      {booting && <LoadingScreen />}
      <div className={booting ? 'invisible' : undefined}>
        <RouterProvider router={router} />
      </div>
      <Toaster
        position="bottom-right"
        theme={theme}
        toastOptions={{
          style: {
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            fontSize: '13px',
          },
        }}
      />
    </ErrorBoundary>
  );
}

export default App;