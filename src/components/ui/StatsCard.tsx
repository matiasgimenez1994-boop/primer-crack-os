import { cn } from"@/lib/utils";
import type { LucideIcon } from"lucide-react";

interface StatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
  className?: string;
}

export function StatsCard({ icon: Icon, label, value, sub, alert, className }: StatsCardProps) {
  return (<div className={cn("bg-white rounded-xl border shadow-card p-5 flex flex-col gap-3",
      alert ?"border-orange-200 bg-orange-50" :"border-border-default",
      className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">{label}</span>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
          alert ?"bg-orange-100" :"bg-bg-subtle")}>
          <Icon className={cn("w-4 h-4", alert ?"text-status-warning" :"text-accent-green")} />
        </div>
      </div>
      <div>
        <p className="text-2xl font-semibold text-text-primary font-mono whitespace-nowrap">{value}</p>
        {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
      </div>
    </div>);
}
