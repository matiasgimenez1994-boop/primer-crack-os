import { cn } from"@/lib/utils";

export function LoadingSpinner({ className }: { className?: string }) {
  return (<div
      className={cn("w-5 h-5 border-2 border-border-default border-t-accent-green rounded-full animate-spin",
        className)}
    />);
}

export function PageLoader() {
  return (<div className="flex items-center justify-center min-h-[300px]">
      <LoadingSpinner className="w-8 h-8" />
    </div>);
}

