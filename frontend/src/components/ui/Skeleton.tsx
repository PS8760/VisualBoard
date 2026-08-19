import { cn } from '../../utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-sm bg-paper-3', className)} />;
}

export function CanvasSkeleton() {
  return (
    <div className="grid-paper absolute inset-0">
      <div className="flex h-full items-center justify-center">
        <div className="w-[380px] space-y-3 opacity-60">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-72" />
          <div className="flex gap-3">
            <Skeleton className="h-40 w-64" />
            <Skeleton className="h-40 w-40" />
          </div>
          <Skeleton className="h-16 w-72" />
        </div>
      </div>
    </div>
  );
}