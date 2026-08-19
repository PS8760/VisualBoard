import type { ReactNode } from 'react';
import { cn } from '../../utils';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-line-2 bg-paper px-1 font-mono text-[10px] font-medium text-ink-2 shadow-xs',
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function KbdGroup({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {keys.map((key, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          <Kbd>{key}</Kbd>
          {i < keys.length - 1 && <span className="text-ink-3">+</span>}
        </span>
      ))}
    </span>
  );
}
