export type QuoteCategory = "green_coffee" | "brand_creation" | "machines";
export type QuoteStatus = "draft" | "issued" | "accepted" | "rejected" | "invoiced";
export type QuoteItemKind = "green_coffee" | "roast_service" | "machine" | "destoner" | "other";

export const QUOTE_CATEGORY_LABELS: Record<QuoteCategory, string> = {
  green_coffee: "Cafe verde",
  brand_creation: "Crea tu Marca",
  machines: "Maquinas",
};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Borrador",
  issued: "Emitida",
  accepted: "Aceptada",
  rejected: "Rechazada",
  invoiced: "Convertida a venta",
};

export const QUOTE_KIND_LABELS: Record<QuoteItemKind, string> = {
  green_coffee: "Cafe verde",
  roast_service: "Servicio de tueste",
  machine: "Tostadora",
  destoner: "Destoner",
  other: "Otro",
};

export function calculateQuoteTotals(
  items: Array<{ quantity: number; unit_price: number }>,
  taxEnabled: boolean,
  taxRate: number
) {
  const subtotal = items.reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
  }, 0);
  const taxAmount = taxEnabled ? subtotal * ((Number(taxRate) || 0) / 100) : 0;
  return {
    subtotal,
    taxAmount,
    total: subtotal + taxAmount,
  };
}

export function nextQuoteNumber(existingCount: number) {
  const year = new Date().getFullYear();
  return `COT-${year}-${String(existingCount + 1).padStart(4, "0")}`;
}
