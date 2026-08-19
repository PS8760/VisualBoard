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

/**
 * Inline script injected into <head> via index.html to apply the saved theme
 * class before React hydrates — prevents light flash on dark preference.
 * Not used directly by this component but documented here for reference.
 */
export function getThemeInitScript(): string {
  return `
    (function(){
      try {
        var t = localStorage.getItem('visualboard-theme');
        if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        }
      } catch(e){}
    })();
  `;
}
