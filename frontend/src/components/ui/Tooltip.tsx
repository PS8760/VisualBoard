import { useEffect, useState, type ReactNode } from 'react';
import {
  useFloating,
  autoUpdate,
  offset,
  flip,
  shift,
  useHover,
  useFocus,
  useDismiss,
  useRole,
  useInteractions,
  useDelayGroup,
  FloatingPortal,
  FloatingDelayGroup,
  type Placement,
} from '@floating-ui/react';
import { cn } from '../../utils';

interface TooltipProps {
  children: ReactNode;
  label: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  /** Shortcut keys rendered next to the label */
  shortcut?: string[];
  /** Hover delay before opening (ms); neighbours open instantly once one is shown. */
  delay?: number;
}

/**
 * Wrap a toolbar (or the whole app) so moving along buttons shows each
 * tooltip immediately after the first one has opened — like Figma/macOS.
 */
export function TooltipGroup({ children }: { children: ReactNode }) {
  return (
    <FloatingDelayGroup delay={{ open: 450, close: 60 }} timeoutMs={250}>
      {children}
    </FloatingDelayGroup>
  );
}

/**
 * Accessible tooltip on @floating-ui/react.
 *
 * - Hover (with delay) or *keyboard* focus opens it — a mouse click never
 *   leaves it stuck open (the old focus-within behaviour covered menus).
 * - Pressing the trigger closes it, and it never shows while the trigger's
 *   own menu/popover is open (`aria-expanded="true"` inside the trigger).
 * - Rendered in a portal above all UI, flips/shifts to stay on screen, and
 *   is `pointer-events: none` so it can never block a click.
 */
function hasOpenMenu(el: Element | null) {
  return !!el && (el.getAttribute('aria-expanded') === 'true' || !!el.querySelector('[aria-expanded="true"]'));
}

export function Tooltip({ children, label, side = 'bottom', shortcut, className, delay }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context, elements } = useFloating({
    open,
    onOpenChange: (next) => {
      // Never cover the trigger's own menu/popover.
      if (next && hasOpenMenu(context.elements.domReference as Element | null)) return;
      setOpen(next);
    },
    placement: side as Placement,
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
  });

  const { delay: groupDelay } = useDelayGroup(context);
  const hover = useHover(context, {
    delay: delay !== undefined ? { open: delay, close: 0 } : groupDelay,
    // Close the instant the pointer leaves the trigger, so a tooltip never
    // lingers over a neighbouring control (e.g. the pen bar above the dock).
    move: false,
  });
  const focus = useFocus(context, { visibleOnly: true });
  const dismiss = useDismiss(context, { referencePress: true });
  const role = useRole(context, { role: 'tooltip' });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  // A menu opened from the keyboard while the tooltip shows closes it too.
  const reference = elements.domReference as Element | null;
  useEffect(() => {
    if (!open || !reference) return;
    const observer = new MutationObserver(() => hasOpenMenu(reference) && setOpen(false));
    observer.observe(reference, { attributes: true, subtree: true, attributeFilter: ['aria-expanded'] });
    return () => observer.disconnect();
  }, [open, reference]);

  // Callback refs (not React ref objects) — safe to pass during render.
  const { setReference, setFloating } = refs;

  return (
    <>
      <span ref={setReference} className={cn('relative inline-flex', className)} {...getReferenceProps()}>
        {children}
      </span>
      {open && (
        <FloatingPortal>
          <div
            ref={setFloating}
            style={floatingStyles}
            className="pointer-events-none z-[200]"
            {...getFloatingProps()}
          >
            <span
              className="vb-tooltip block whitespace-nowrap rounded-md border border-line-2 bg-ink px-2 py-1 text-[11px] font-medium text-paper shadow-md"
            >
              <span className="inline-flex items-baseline gap-2">
                {label}
                {shortcut && shortcut.length > 0 && (
                  <span className="font-mono text-[10px] text-paper/60">{shortcut.join(' ')}</span>
                )}
              </span>
            </span>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
