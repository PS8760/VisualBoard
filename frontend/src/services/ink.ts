/**
 * Theme-adaptive ink: strokes/text stored with the default near-black ink
 * render in a light ink on the dark theme so drawings stay legible for
 * everyone regardless of their theme. Stored data is never rewritten.
 */
const INK_VALUES = new Set(['#1b1a17', '#000000', '#000', 'black']);
const DARK_INK = '#ebe8df';

export const isDarkTheme = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

export function themeInk(color: string | undefined | null): string | undefined {
  if (!color) return color ?? undefined;
  return isDarkTheme() && INK_VALUES.has(color.toLowerCase()) ? DARK_INK : color;
}
