import { cn } from"@/lib/utils";
import { COFFEE_STATUS_LABELS, ROAST_STATUS_LABELS, ROAST_LEVEL_LABELS } from"@/lib/costs";

type BadgeVariant ="active"|"depleted"|"reserved"|"trial"|"production"|"discarded"|"light"|"medium"|"medium_dark"|"dark";

const variantStyles: Record<BadgeVariant, string> = {
  active:"bg-green-50 text-green-700 border-green-200",
  depleted:"bg-red-50 text-red-600 border-red-200",
  reserved:"bg-blue-50 text-blue-600 border-blue-200",
  trial:"bg-yellow-50 text-yellow-700 border-yellow-200",
  production:"bg-green-50 text-green-700 border-green-200",
  discarded:"bg-gray-100 text-gray-500 border-gray-200",
  light:"bg-amber-50 text-amber-600 border-amber-200",
  medium:"bg-orange-50 text-orange-600 border-orange-200",
  medium_dark:"bg-red-50 text-red-600 border-red-200",
  dark:"bg-stone-100 text-stone-700 border-stone-300",
};

const allLabels: Record<string, string> = {
  ...COFFEE_STATUS_LABELS, ...ROAST_STATUS_LABELS, ...ROAST_LEVEL_LABELS,
};

export function StatusBadge({ status, className }: { status: BadgeVariant; className?: string }) {
  return (<span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border",
      variantStyles[status] ??"bg-gray-100 text-gray-600 border-gray-200",
      className)}>
      {allLabels[status] ?? status}
    </span>);
}
