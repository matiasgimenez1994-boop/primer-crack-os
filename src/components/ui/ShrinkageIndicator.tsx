import { cn } from "@/lib/utils";
import { getShrinkageBg } from "@/lib/costs";

interface ShrinkageIndicatorProps {
  pct: number;
  className?: string;
}

export function ShrinkageIndicator({ pct, className }: ShrinkageIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium border",
        getShrinkageBg(pct),
        className
      )}
    >
      {pct.toFixed(1)}%
    </span>
  );
}
