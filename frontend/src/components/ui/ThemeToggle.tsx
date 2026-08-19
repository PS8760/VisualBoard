import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../../stores/useThemeStore';
import { cn } from '../../utils';

interface ThemeToggleProps {
  /** Extra classes forwarded to the button wrapper */
  className?: string;
  /** 'sm' → h-7 w-7, 'md' (default) → h-8 w-8 */
  size?: 'sm' | 'md';
}

/**
 * Animated Sun ↔ Moon theme toggle.
 * The icon rotates + fades out then the next one rotates + fades in
 * using a pure-CSS keyframe defined in index.css.
 * No JS animation libraries — just CSS transform + opacity.
 */
export function ThemeToggle({ className, size = 'md' }: ThemeToggleProps) {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === 'dark';

  const dim = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8';
  const iconSize = size === 'sm' ? 13 : 15;

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      className={cn(
        'relative flex shrink-0 items-center justify-center rounded-sm border border-line-2 text-ink-2 transition-colors duration-150 hover:border-line-3 hover:text-ink',
        dim,
        className,
      )}
    >
      {/* Sun — visible in light mode */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: isDark ? 0 : 1,
          transform: isDark ? 'rotate(90deg) scale(0.7)' : 'rotate(0deg) scale(1)',
          transition: 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <Sun size={iconSize} strokeWidth={1.8} />
      </span>

      {/* Moon — visible in dark mode */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: isDark ? 1 : 0,
          transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.7)',
          transition: 'opacity 0.25s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <Moon size={iconSize} strokeWidth={1.8} />
      </span>
    </button>
  );
}
