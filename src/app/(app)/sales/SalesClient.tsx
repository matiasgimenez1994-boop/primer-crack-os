"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag, DollarSign, Package, Trash2, FileText } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatsCard } from "@/components/ui/StatsCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Order } from "@/types";
import { useRouter } from "next/navigation";

const weightLabels: Record<number, string> = {
  250: "250 g",
  500: "500 g",
  1000: "1 kg",
};

interface Props {
  orders: Order[];
  currency: string;
  totalRevenue: number;
  totalProfit: number;
  totalUnits: number;
  avgMargin: number;
}

function documentLabel(order: Order) {
  if (order.document_type === "proforma") return "Proforma";
  if (order.document_type === "boleta") return "Boleta";
  return "Borrador";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Borrador",
    proforma: "Proforma",
    pending: "Pendiente",
    confirmed: "Confirmada",
    roasting: "Tostando",
    ready: "Lista",
    delivered: "Entregada",
    cancelled: "Cancelada",
  };
  return labels[status] ?? status;
}

function itemLabel(item: any) {
  if (item.product_type === "green") {
    const name = item.green_coffees?.name ?? "Cafe verde";
    return name + " - Verde " + Number(item.green_weight_kg ?? 0).toFixed(3) + " kg";
  }

  const name = item.roast_batches?.green_coffees?.name ?? item.green_coffees?.name ?? "Cafe tostado";
  const weight = weightLabels[item.weight_grams] ?? String(item.weight_grams ?? "") + " g";
  return name + " - " + weight + " x " + item.quantity;
}

export function SalesClient({ orders: initialOrders, currency, totalRevenue, totalUnits }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [deleting, setDeleting] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  async function handleDelete(orderId: string) {
    const order = orders.find((entry) => entry.id === orderId);
    if (!order) return;

    if (order.inventory_committed_at) {
      toast.error("No se puede eliminar una venta con inventario ya confirmado");
      return;
    }

    if (!confirm("Eliminar esta venta? Esta accion no se puede deshacer.")) return;
    setDeleting(orderId);

    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) {
      toast.error("Error al eliminar la venta");
      setDeleting(null);
      return;
    }

    setOrders((current) => current.filter((entry) => entry.id !== orderId));
    toast.success("Venta eliminada");
    setDeleting(null);
    router.refresh();
  }

  const totalHistRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ventas</h1>
        <Link href="/sales/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar venta
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard icon={DollarSign} label="Ingresos este mes" value={formatCurrency(totalRevenue, currency)} />
        <StatsCard icon={FileText} label="Documentos" value={String(orders.length)} sub="historico" />
        <StatsCard icon={Package} label="Items vendidos" value={String(totalUnits)} sub="historico" />
        <StatsCard icon={ShoppingBag} label="Total ventas" value={formatCurrency(totalHistRevenue, currency)} sub="historico" />
      </div>

      {orders.length === 0 ? (
        <div className="card">
          <EmptyState icon={ShoppingBag} title="No hay ventas registradas" description="Registra tu primera venta para trackear ingresos e inventario." actionLabel="+ Registrar venta" actionHref="/sales/new" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Documento</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Productos</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Cliente</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Subtotal</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">IVA</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Total</th>
                  <th className="px-3 py-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border-default last:border-0 hover:bg-[#F8FAFC] transition-colors group">
                    <td className="px-5 py-3.5 text-text-secondary">{formatDate(order.order_date)}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-text-primary">{documentLabel(order)}</span>
                        <span className="text-xs text-text-secondary">{statusLabel(order.status)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col gap-1">
                        {(order.order_items ?? []).map((item) => <span key={item.id} className="text-text-primary">{itemLabel(item)}</span>)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary hidden md:table-cell">{(order as any).clients?.name ?? order.client_name ?? "-"}</td>
                    <td className="px-5 py-3.5 text-right font-mono whitespace-nowrap">{formatCurrency(order.subtotal_amount ?? 0, currency)}</td>
                    <td className="px-5 py-3.5 text-right font-mono whitespace-nowrap">{formatCurrency(order.tax_amount ?? 0, currency)}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary whitespace-nowrap">{formatCurrency(order.total_amount ?? 0, currency)}</td>
                    <td className="px-3 py-3.5 text-right">
                      <button onClick={() => handleDelete(order.id)} disabled={deleting === order.id || Boolean(order.inventory_committed_at)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-text-secondary hover:text-status-danger hover:bg-red-50 transition-all disabled:opacity-30" title="Eliminar venta">
                        {deleting === order.id ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border-default bg-[#F8FAFC]">
                <tr>
                  <td colSpan={6} className="px-5 py-3 text-xs font-semibold text-text-secondary">Total historico</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-text-primary whitespace-nowrap">{formatCurrency(totalHistRevenue, currency)}</td>
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
