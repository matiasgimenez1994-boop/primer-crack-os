import type { ExpenseCategory, ExpenseFrequency } from "@/types";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  energy: "Energía / Gas",
  rent: "Alquiler",
  packaging: "Empaque / Etiquetas",
  maintenance: "Mantenimiento",
  labor: "Mano de obra",
  marketing: "Marketing",
  supplies: "Insumos",
  other: "Otro",
};

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  energy: "bg-yellow-50 text-yellow-700 border-yellow-200",
  rent: "bg-blue-50 text-blue-700 border-blue-200",
  packaging: "bg-purple-50 text-purple-700 border-purple-200",
  maintenance: "bg-orange-50 text-orange-700 border-orange-200",
  labor: "bg-green-50 text-green-700 border-green-200",
  marketing: "bg-pink-50 text-pink-700 border-pink-200",
  supplies: "bg-teal-50 text-teal-700 border-teal-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

export const CATEGORY_ICONS: Record<ExpenseCategory, string> = {
  energy: "⚡",
  rent: "🏠",
  packaging: "📦",
  maintenance: "🔧",
  labor: "👷",
  marketing: "📢",
  supplies: "🛒",
  other: "📋",
};

export const FREQUENCY_LABELS: Record<ExpenseFrequency, string> = {
  once: "Único",
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensual",
  yearly: "Anual",
};

// Normalizar monto a mensual para comparativas
export function toMonthlyAmount(amount: number, frequency: ExpenseFrequency): number {
  switch (frequency) {
    case "once": return amount;
    case "daily": return amount * 30;
    case "weekly": return amount * 4.33;
    case "monthly": return amount;
    case "yearly": return amount / 12;
  }
}
