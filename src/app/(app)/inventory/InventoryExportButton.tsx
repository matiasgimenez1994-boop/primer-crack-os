"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import type { GreenCoffee } from "@/types";

const STATUS_LABELS = {
  active: "Activo",
  depleted: "Agotado",
  reserved: "Reservado",
} as const;

export function InventoryExportButton({
  coffees,
  currency,
}: {
  coffees: GreenCoffee[];
  currency: string;
}) {
  async function downloadExcel() {
    if (coffees.length === 0) {
      toast.error("No hay inventario para exportar");
      return;
    }

    try {
      const XLSX = await import("xlsx");
      const rows: Array<Record<string, string | number>> = coffees.map((coffee) => ({
        "Café": coffee.name,
        "País": coffee.origin_country ?? "",
        "Finca / Productor": coffee.farm_producer ?? "",
        "Variedad": coffee.variety ?? "",
        "Proceso": coffee.process ?? "",
        "Proveedor": coffee.supplier ?? "",
        "Fecha de compra": coffee.purchase_date ?? "",
        "Stock inicial (kg)": Number(coffee.initial_stock_kg),
        "Stock actual (kg)": Number(coffee.current_stock_kg),
        "Consumido (kg)": Number(coffee.initial_stock_kg) - Number(coffee.current_stock_kg),
        [`Precio por kg (${currency})`]: Number(coffee.purchase_price_per_kg),
        [`Valor del stock (${currency})`]: Number(coffee.current_stock_kg) * Number(coffee.purchase_price_per_kg),
        "Estado": STATUS_LABELS[coffee.status],
      }));

      rows.push({
        "Café": "TOTAL INVENTARIO",
        "País": "",
        "Finca / Productor": "",
        "Variedad": "",
        "Proceso": "",
        "Proveedor": "",
        "Fecha de compra": "",
        "Stock inicial (kg)": coffees.reduce((sum, coffee) => sum + Number(coffee.initial_stock_kg), 0),
        "Stock actual (kg)": coffees.reduce((sum, coffee) => sum + Number(coffee.current_stock_kg), 0),
        "Consumido (kg)": coffees.reduce((sum, coffee) => sum + Number(coffee.initial_stock_kg) - Number(coffee.current_stock_kg), 0),
        [`Precio por kg (${currency})`]: 0,
        [`Valor del stock (${currency})`]: coffees.reduce((sum, coffee) => sum + Number(coffee.current_stock_kg) * Number(coffee.purchase_price_per_kg), 0),
        "Estado": "",
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet["!cols"] = [30, 14, 28, 20, 18, 22, 16, 18, 18, 18, 20, 24, 14].map((wch) => ({ wch }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Inventario verde");
      XLSX.writeFile(workbook, `inventario-cafe-verde-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Excel de inventario descargado");
    } catch {
      toast.error("No se pudo generar el Excel");
    }
  }

  return (
    <button type="button" onClick={downloadExcel} className="btn-secondary">
      <Download className="w-4 h-4" /> Descargar Excel
    </button>
  );
}
