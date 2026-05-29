import type { CostBreakdown, MarginResult } from"@/types";

export function calculateCosts(greenWeightKg: number,
  roastedWeightKg: number,
  purchasePricePerKg: number,
  packagingCostPerKg: number,
  energyCostPerKg: number,
  laborCostPerKg: number): CostBreakdown {
  const shrinkagePct =
    greenWeightKg > 0
      ? ((greenWeightKg - roastedWeightKg) / greenWeightKg) * 100
      : 0;

  const greenCostBase = greenWeightKg * purchasePricePerKg;
  const effectiveCostPerKgRoasted =
    roastedWeightKg > 0 ? greenCostBase / roastedWeightKg : 0;

  const totalCostPerKg =
    effectiveCostPerKgRoasted +
    packagingCostPerKg +
    energyCostPerKg +
    laborCostPerKg;

  return {
    greenCostBase,
    effectiveCostPerKgRoasted,
    packagingCostPerKg,
    energyCostPerKg,
    laborCostPerKg,
    totalCostPerKg,
    shrinkagePct,
  };
}

export function calculateMargin(sellingPrice: number,
  weightGrams: number,
  totalCostPerKg: number): MarginResult {
  const costForUnit = totalCostPerKg * (weightGrams / 1000);
  const profit = sellingPrice - costForUnit;
  const marginPct = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

  return {
    weightGrams,
    costForUnit,
    sellingPrice,
    profit,
    marginPct,
  };
}

export function getShrinkageColor(pct: number): string {
  if (pct < 13) return"text-status-success";
  if (pct <= 18) return"text-status-warning";
  return"text-status-danger";
}

export function getShrinkageBg(pct: number): string {
  if (pct < 13) return"bg-green-50 text-status-success border-green-200";
  if (pct <= 18) return"bg-orange-50 text-status-warning border-orange-200";
  return"bg-red-50 text-status-danger border-red-200";
}

export const ROAST_LEVEL_LABELS: Record<string, string> = {
  light:"Claro",
  medium:"Medio",
  medium_dark:"Medio Oscuro",
  dark:"Oscuro",
};

export const ROAST_STATUS_LABELS: Record<string, string> = {
  trial:"Prueba",
  production:"Producción",
  discarded:"Descartado",
};

export const COFFEE_STATUS_LABELS: Record<string, string> = {
  active:"Activo",
  depleted:"Agotado",
  reserved:"Reservado",
};

export const PROCESS_OPTIONS = ["Lavado","Natural","Honey","Anaeróbico","Wet-hulled","Otro",
];
