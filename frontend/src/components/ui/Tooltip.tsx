import type { ReactNode } from 'react';
import { cn } from '../../utils';

interface TooltipProps {
  children: ReactNode;
  label: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  /** Shortcut keys rendered under the label */
  shortcut?: string[];
  delay?: number;
}

export function Tooltip({
  children,
  label,
  side = 'bottom',
  shortcut,
  className,
}: TooltipProps) {
  const sideClass: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 translate-y-[-6px] group-hover:translate-y-[-1px] mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 translate-y-1 group-hover:translate-y-0 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 -translate-x-1 group-hover:-translate-x-0 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 translate-x-1 group-hover:translate-x-0 ml-1.5',
  };

  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-line-2 bg-ink px-2 py-1 text-[11px] font-medium text-paper opacity-0 shadow-md transition-all duration-150 group-hover/tt:opacity-100 group-focus-within/tt:opacity-100',
          sideClass[side],
        )}
      >
        <span className="inline-flex items-baseline gap-2">
          {label}
          {shortcut && shortcut.length > 0 && (
            <span className="font-mono text-[10px] text-paper/60">
              {shortcut.join(' ')}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}