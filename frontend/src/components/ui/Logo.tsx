import { cn } from '../../utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
  wordmarkClassName?: string;
}

const sizes = { sm: 18, md: 22, lg: 26 } as const;

export function LogoMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="6.5" stroke="currentColor" strokeWidth="2.2" />
      <g stroke="currentColor" strokeWidth="1.6" opacity="0.65">
        <path d="M9.5 11 L20 11 M9.5 11 L14.5 20.5 M20 11 L15.5 14" />
      </g>
      <g fill="currentColor">
        <circle cx="9.5" cy="11" r="2.5" />
        <circle cx="20" cy="11" r="1.8" />
        <circle cx="14.5" cy="20.5" r="2.5" />
      </g>
      <circle cx="23" cy="22.5" r="1.9" fill="#d9480f" />
    </svg>
  );
}

export default function Logo({
  size = 'md',
  showWordmark = true,
  className,
  wordmarkClassName,
}: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 text-ink', className)}>
      <LogoMark size={sizes[size]} />
      {showWordmark && (
        <span
          className={cn(
            'font-semibold tracking-tight',
            size === 'sm' ? 'text-[15px]' : size === 'lg' ? 'text-xl' : 'text-[17px]',
            wordmarkClassName,
          )}
        >
          VisualBoard
        </span>
      )}
    </span>
  );
}
