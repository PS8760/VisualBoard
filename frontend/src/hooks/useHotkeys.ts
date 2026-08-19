import { useEffect } from 'react';

export interface HotkeyBinding {
  /** Lowercase key, 'mod', 'shift', 'alt', or an exact key like 'delete' */
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** When true, the binding is skipped if focus is inside a text field */
  skipWhenTyping?: boolean;
  handler: (e: KeyboardEvent) => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    target.isContentEditable ||
    tag === 'SELECT'
  );
}

export function useHotkeys(bindings: HotkeyBinding[], deps: unknown[] = []) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      for (const binding of bindings) {
        const modifierMatch =
          binding.ctrl === e.ctrlKey && binding.meta === e.metaKey && binding.shift === e.shiftKey;

        let keyMatch: boolean;
        if (binding.key === 'mod') {
          keyMatch = (e.metaKey || e.ctrlKey) && key !== 'meta' && key !== 'control';
        } else if (binding.key.startsWith('exact:')) {
          keyMatch = key === binding.key.slice(6);
        } else {
          keyMatch = key === binding.key;
        }

        if (!keyMatch || !modifierMatch) continue;
        if (binding.shift && e.key === key && binding.shift !== e.shiftKey) continue;

        if (binding.skipWhenTyping && isTypingTarget(e.target)) continue;

        e.preventDefault();
        e.stopPropagation();
        binding.handler(e);
        break;
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
