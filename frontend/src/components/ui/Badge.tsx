import type { ReactNode } from 'react';
import { cn } from '../../utils';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'outline';

const tones: Record<Tone, string> = {
  neutral: 'bg-paper-2 text-ink-2 border-line',
  accent: 'bg-accent-soft text-accent border-accent/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  outline: 'bg-transparent text-ink-2 border-line-2',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={cn('h-1.5 w-1.5 rounded-full bg-current', className)} />;
}
