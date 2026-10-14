import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-ink text-paper hover:bg-ink-hover border border-transparent shadow-xs active:scale-[0.98]',
  accent:
    'bg-accent text-white hover:bg-accent-2 border border-transparent shadow-xs active:scale-[0.98]',
  secondary:
    'bg-paper text-ink border border-line-2 hover:border-line-3 hover:bg-paper-2 active:scale-[0.98]',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-paper-2',
  danger:
    'bg-transparent text-danger border border-danger/30 hover:bg-danger-soft hover:border-danger/40',
};

const sizes: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', icon, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center rounded-sm font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
      ) : (
        icon
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';
