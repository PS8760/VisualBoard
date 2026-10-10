import { useEffect } from 'react';
import { useThemeStore } from '../stores/useThemeStore';

/**
 * Syncs the Zustand theme state to `<html class="dark">`.
 * Also applies the initial class before the first paint to prevent flash.
 * Render this once, high in the tree (inside App).
 */
export function ThemeProvider() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return null;
}
