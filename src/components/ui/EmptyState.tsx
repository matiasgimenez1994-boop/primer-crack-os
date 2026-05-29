import { cn } from"@/lib/utils";
import type { LucideIcon } from"lucide-react";
import Link from"next/link";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, className }: EmptyStateProps) {
  return (<div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      <div className="w-14 h-14 rounded-2xl bg-bg-subtle flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-accent-green" />
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-secondary max-w-xs">{description}</p>
      {actionLabel && actionHref && (<Link href={actionHref}
          className="mt-5 inline-flex items-center gap-2 bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-medium transition-colors">
          {actionLabel}
        </Link>)}
    </div>);
}
