"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ShoppingBag, DollarSign, Package, Trash2, FileText, Download, Pencil } from "lucide-react";
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
  businessName: string;
  totalRevenue: string;
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

function documentFilename(order: Order) {
  return documentLabel(order).toLowerCase() + "-" + order.id.slice(0, 8) + ".pdf";
}

function paymentLabel(order: Order) {
  const status = (order as any).payment_status ?? "paid";
  if (status === "pending") return "Pendiente";
  if (status === "partial") return "Parcial";
  return "Pagado";
}

function saleCurrency(order: Order, fallback: string) {
  return (order as any).payment_currency ?? fallback;
}

function paymentCurrency(order: Order, fallback: string) {
  return saleCurrency(order, fallback);
}

function paymentClass(order: Order) {
  const status = (order as any).payment_status ?? "paid";
  if (status === "pending") return "bg-orange-50 text-orange-700 border-orange-200";
  if (status === "partial") return "bg-blue-50 text-blue-700 border-blue-200";
  return "bg-green-50 text-status-success border-green-200";
}

export function SalesClient({ orders: initialOrders, currency, businessName, totalRevenue, totalUnits }: Props) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
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

  async function handleDownload(order: Order) {
    setDownloading(order.id);
    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const clientName = (order as any).clients?.name ?? order.client_name ?? "Sin cliente";
      const title = documentLabel(order);

      doc.setFillColor(44, 24, 16);
      doc.rect(0, 0, 210, 26, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(businessName || "Primer crack OS", 14, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Primer crack OS", 14, 18);
      doc.text(title, 196, 11, { align: "right" });
      doc.text(formatDate(order.order_date), 196, 18, { align: "right" });

      doc.setTextColor(28, 18, 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(title + " #" + order.id.slice(0, 8), 14, 38);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Cliente: " + clientName, 14, 46);
      doc.text("Estado: " + statusLabel(order.status), 14, 52);
      if (order.delivery_date) doc.text("Entrega: " + formatDate(order.delivery_date), 14, 58);
      if (order.notes) doc.text("Notas: " + order.notes, 14, order.delivery_date ? 64 : 58);

      const rows = (order.order_items ?? []).map((item: any) => [
        itemLabel(item),
        item.product_type === "green" ? Number(item.green_weight_kg ?? 0).toFixed(3) + " kg" : String(item.quantity),
        formatCurrency(Number(item.unit_price ?? 0), saleCurrency(order, currency)),
        Number(item.tax_rate ?? order.tax_rate ?? 0).toFixed(2) + "%",
        formatCurrency(Number(item.total_amount ?? 0), saleCurrency(order, currency)),
      ]);

      autoTable(doc, {
        startY: order.notes ? 70 : 64,
        head: [["Producto", "Cant.", "Precio", "IVA", "Total"]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: [44, 24, 16], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [28, 18, 8] },
        alternateRowStyles: { fillColor: [253, 250, 246] },
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFontSize(10);
      doc.setTextColor(28, 18, 8);
      doc.text("Subtotal", 150, finalY);
      doc.text(formatCurrency(Number(order.subtotal_amount ?? 0), saleCurrency(order, currency)), 196, finalY, { align: "right" });
      doc.text("IVA", 150, finalY + 7);
      doc.text(formatCurrency(Number(order.tax_amount ?? 0), saleCurrency(order, currency)), 196, finalY + 7, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text("Total", 150, finalY + 16);
      doc.text(formatCurrency(Number(order.total_amount ?? 0), saleCurrency(order, currency)), 196, finalY + 16, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setTextColor(160, 150, 140);
      doc.setFontSize(7);
      doc.text("Documento generado por Primer crack OS", 14, 290);
      doc.save(documentFilename(order));
    } catch (error) {
      toast.error("No se pudo descargar el documento");
    } finally {
      setDownloading(null);
    }
  }

  const totalsByCurrency = orders.reduce<Record<string, number>>((acc, order) => {
    const orderCurrency = saleCurrency(order, currency);
    acc[orderCurrency] = (acc[orderCurrency] ?? 0) + Number(order.total_amount ?? 0);
    return acc;
  }, {});
  const totalHistRevenueLabel = Object.entries(totalsByCurrency)
    .filter(([, value]) => value !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([orderCurrency, value]) => formatCurrency(value, orderCurrency))
    .join(" / ") || formatCurrency(0, currency);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Ventas</h1>
        <Link href="/sales/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar venta
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard icon={DollarSign} label="Ingresos este mes" value={totalRevenue} />
        <StatsCard icon={FileText} label="Documentos" value={String(orders.length)} sub="historico" />
        <StatsCard icon={Package} label="Items vendidos" value={String(totalUnits)} sub="historico" />
        <StatsCard icon={ShoppingBag} label="Total ventas" value={totalHistRevenueLabel} sub="por moneda" />
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
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Pago</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Acciones</th>
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
                    <td className="px-5 py-3.5 text-right font-mono whitespace-nowrap">{formatCurrency(order.subtotal_amount ?? 0, saleCurrency(order, currency))}</td>
                    <td className="px-5 py-3.5 text-right font-mono whitespace-nowrap">{formatCurrency(order.tax_amount ?? 0, saleCurrency(order, currency))}</td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary whitespace-nowrap">{formatCurrency(order.total_amount ?? 0, saleCurrency(order, currency))}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${paymentClass(order)}`}>{paymentLabel(order)}</span>
                        {(order as any).amount_paid != null && <span className="text-[11px] text-text-secondary">{formatCurrency(Number((order as any).amount_paid ?? 0), paymentCurrency(order, currency))}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Link href={`/sales/${order.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-text-primary hover:border-accent-green hover:text-accent-green hover:bg-green-50 transition-all" title="Editar venta">
                          <Pencil className="w-3.5 h-3.5" />
                          Editar
                        </Link>
                        <button onClick={() => handleDownload(order)} disabled={downloading === order.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border-default px-2.5 py-1.5 text-xs font-medium text-text-primary hover:border-accent-green hover:text-accent-green hover:bg-green-50 transition-all disabled:opacity-60" title="Descargar boleta o proforma">
                          {downloading === order.id ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Descargar
                        </button>
                        <button onClick={() => handleDelete(order.id)} disabled={deleting === order.id || Boolean(order.inventory_committed_at)} className="p-1.5 rounded-lg text-text-secondary hover:text-status-danger hover:bg-red-50 transition-all disabled:opacity-30" title="Eliminar venta">
                          {deleting === order.id ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-border-default bg-[#F8FAFC]">
                <tr>
                  <td colSpan={6} className="px-5 py-3 text-xs font-semibold text-text-secondary">Total historico</td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-text-primary whitespace-nowrap">{totalHistRevenueLabel}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
