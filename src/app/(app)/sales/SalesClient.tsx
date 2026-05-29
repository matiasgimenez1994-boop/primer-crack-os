"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag, TrendingUp, DollarSign, Package, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatsCard } from "@/components/ui/StatsCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Sale } from "@/types";
import { useRouter } from "next/navigation";

const weightLabels: Record<number, string> = {
  250: "250 g",
  500: "500 g",
  1000: "1 kg",
};

interface Props {
  sales: Sale[];
  currency: string;
  totalRevenue: number;
  totalProfit: number;
  totalUnits: number;
  avgMargin: number;
}

export function SalesClient({ sales: initialSales, currency, totalRevenue, totalProfit, totalUnits, avgMargin }: Props) {
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [deleting, setDeleting] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleDelete(saleId: string) {
    if (!confirm("¿Eliminar esta venta? Esta acción no se puede deshacer.")) return;
    setDeleting(saleId);

    const sale = sales.find(s => s.id === saleId);

    // Si es venta de café verde, devolver stock
    if (sale?.product_type === "green" && sale.green_coffee_id && sale.green_weight_kg) {
      const totalKgToRestore = sale.green_weight_kg * sale.quantity;
      const { data: coffee } = await supabase
        .from("green_coffees").select("current_stock_kg, status").eq("id", sale.green_coffee_id).single();
      if (coffee) {
        const newStock = coffee.current_stock_kg + totalKgToRestore;
        await supabase.from("green_coffees").update({
          current_stock_kg: newStock,
          status: coffee.status === "depleted" ? "active" : coffee.status,
        }).eq("id", sale.green_coffee_id);
      }
    }

    const { error } = await supabase.from("sales").delete().eq("id", saleId);
    if (error) {
      toast.error("Error al eliminar la venta");
      setDeleting(null);
      return;
    }
    setSales(prev => prev.filter(s => s.id !== saleId));
    toast.success(
      sale?.product_type === "green"
        ? "Venta eliminada y stock restaurado"
        : "Venta eliminada"
    );
    setDeleting(null);
    router.refresh();
  }

  const totalHistRevenue = sales.reduce((s, x) => s + x.final_price, 0);
  const totalHistProfit = sales.reduce((s, x) => s + x.profit, 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ventas</h1>
        <Link href="/sales/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar venta
        </Link>
      </div>

      {/* Stats del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard icon={DollarSign} label="Ingresos este mes"
          value={formatCurrency(totalRevenue, currency)} />
        <StatsCard icon={TrendingUp} label="Ganancia este mes"
          value={formatCurrency(totalProfit, currency)}
          sub={totalRevenue > 0 ? `${avgMargin.toFixed(1)}% margen` : undefined} />
        <StatsCard icon={Package} label="Unidades vendidas"
          value={`${totalUnits}`} sub="este mes" />
        <StatsCard icon={ShoppingBag} label="Total ventas"
          value={`${sales.length}`} sub="histórico" />
      </div>

      {/* Tabla */}
      {sales.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShoppingBag} title="No hay ventas registradas"
            description="Registrá tu primera venta para trackear ingresos y ganancias."
            actionLabel="+ Registrar venta" actionHref="/sales/new" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Cliente</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Cant.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Precio unit.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Descuento</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Ganancia</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {sales.map((s: Sale) => {
                  const coffeeName = s.product_type === "roasted"
                    ? (s as any).roast_batches?.green_coffees?.name
                    : (s as any).green_coffees?.name;
                  const productLabel = s.product_type === "roasted"
                    ? `${coffeeName} · ${weightLabels[s.weight_grams!] ?? s.weight_grams + "g"}`
                    : `${coffeeName} · Verde ${s.green_weight_kg}kg`;

                  return (
                    <tr key={s.id}
                      className="border-b border-border-default last:border-0 hover:bg-[#F8FAFC] transition-colors group">
                      <td className="px-5 py-3.5 text-text-secondary">{formatDate(s.sale_date)}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-text-primary">{productLabel}</span>
                        {s.product_type === "green" && (
                          <span className="ml-2 text-xs bg-green-50 text-status-success border border-green-200 px-1.5 py-0.5 rounded">
                            Verde
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary hidden md:table-cell">
                        {(s as any).clients?.name ?? s.client_name ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">{s.quantity}</td>
                      <td className="px-5 py-3.5 text-right font-mono">
                        {formatCurrency(s.unit_price, currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-text-secondary hidden sm:table-cell">
                        {s.discount_pct > 0 ? (
                          <span className="text-status-warning font-mono">-{s.discount_pct.toFixed(0)}%</span>
                        ) : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary whitespace-nowrap">
                        {formatCurrency(s.final_price, currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono whitespace-nowrap">
                        <span className={s.profit >= 0 ? "text-status-success" : "text-status-danger"}>
                          {formatCurrency(s.profit, currency)}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(s.id)}
                          disabled={deleting === s.id}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-secondary hover:text-status-danger hover:bg-red-50 transition-all"
                          title="Eliminar venta"
                        >
                          {deleting === s.id
                            ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border-default bg-[#F8FAFC]">
                <tr>
                  <td colSpan={6} className="px-5 py-3 text-xs font-semibold text-text-secondary">
                    Total histórico
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-text-primary whitespace-nowrap">
                    {formatCurrency(totalHistRevenue, currency)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold whitespace-nowrap">
                    <span className={totalHistProfit >= 0 ? "text-status-success" : "text-status-danger"}>
                      {formatCurrency(totalHistProfit, currency)}
                    </span>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
