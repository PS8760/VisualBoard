import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils';

export function Container({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mx-auto w-full max-w-[1200px] px-5 md:px-8', className)} {...props}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('py-20 md:py-28', className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      <p
        data-reveal
        className={cn(
          'mono-label mb-3 flex items-center gap-2 text-accent',
          align === 'center' && 'justify-center',
        )}
      >
        <span className="h-px w-4 bg-accent/50" />
        {eyebrow}
      </p>
      <h2
        data-reveal
        className="text-balance text-3xl font-semibold leading-[1.15] tracking-tight text-ink md:text-[40px]"
      >
        {title}
      </h2>
      {description && (
        <p
          data-reveal
          className="text-pretty mt-4 text-[15px] leading-relaxed text-ink-2 md:text-base"
        >
          {description}
        </p>
      )}
    </div>
  );
}
