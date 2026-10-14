import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function uid(prefix = 'el'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

let idCounter = 0;
export function nextId(): string {
  return `${Date.now().toString(36)}${(idCounter++).toString(36)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function throttle<A extends unknown[]>(fn: (...args: A) => void, limit: number) {
  let inThrottle = false;
  return (...args: A) => {
    if (inThrottle) return;
    fn(...args);
    inThrottle = true;
    setTimeout(() => {
      inThrottle = false;
    }, limit);
  };
}
/**
 * Throttle with a trailing call: the first call runs immediately, calls during
 * the window collapse into one that runs when it ends with the latest args.
 * Use when the *last* value matters (cursor resting position, drag end).
 */
export function throttleTrailing<A extends unknown[]>(fn: (...args: A) => void, limit: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: A | null = null;
  return (...args: A) => {
    const now = Date.now();
    const remaining = limit - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      last = now;
      pending = null;
      fn(...args);
      return;
    }
    pending = args;
    if (!timer) {
      timer = setTimeout(() => {
        timer = undefined;
        last = Date.now();
        if (pending) {
          const a = pending;
          pending = null;
          fn(...a);
        }
      }, remaining);
    }
  };
}

const USER_COLORS = ['#d9480f', '#2f9e44', '#1971c2', '#e8590c', '#7048e8', '#0c8599'];

/** Stable per-user color so the same person looks the same on every client. */
export function colorForUser(id: string | number): string {
  const key = String(id);
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]!;
}
