"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, ShoppingBag, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/utils";
import {
  QUOTE_CATEGORY_LABELS,
  QUOTE_KIND_LABELS,
  QUOTE_STATUS_LABELS,
  type QuoteStatus,
} from "@/lib/quotes";
import type { Quotation, QuotationItem, Roaster } from "@/types";

export default function QuoteDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClient();
  const [quote, setQuote] = useState<Quotation | null>(null);
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: r } = await supabase.from("roasters").select("*").eq("user_id", user.id).single();
    if (!r) return;
    setRoaster(r);

    const { data } = await supabase
      .from("quotations")
      .select("*, quotation_items(*, green_coffees(name))")
      .eq("id", id)
      .eq("roaster_id", r.id)
      .single();

    setQuote((data as Quotation) ?? null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function updateStatus(status: QuoteStatus) {
    const { error } = await supabase.from("quotations").update({ status }).eq("id", id);
    if (error) {
      toast.error("Error al actualizar la cotización");
      return;
    }
    toast.success(`Cotización marcada como ${QUOTE_STATUS_LABELS[status].toLowerCase()}`);
    load();
  }

  async function convertToSale() {
    if (!quote || !roaster) return;
    if (!confirm("¿Convertir esta cotización en una venta? Se conservará el desglose de IVA.")) return;

    const { data: order, error } = await supabase.from("orders").insert({
      roaster_id: roaster.id,
      client_id: quote.client_id,
      client_name: quote.client_name,
      order_date: todayISO(),
      delivery_date: null,
      status: "pending",
      document_type: "boleta",
      tax_rate: quote.tax_rate,
      subtotal_amount: quote.subtotal_amount,
      tax_amount: quote.tax_amount,
      total_amount: quote.total_amount,
      payment_type: "transfer",
      payment_status: "pending",
      payment_currency: quote.currency,
      amount_paid: 0,
      due_date: null,
      paid_at: null,
      notes: `Cotización ${quote.quote_number}`,
    }).select("id").single();

    if (error || !order) {
      toast.error("Error al crear la venta desde la cotización");
      return;
    }

    const orderItems = items.map((item) => {
      const itemTaxEnabled = item.tax_enabled ?? quote.tax_enabled;
      const itemTaxRate = itemTaxEnabled ? Number(item.tax_rate ?? quote.tax_rate ?? 0) : 0;
      const itemTaxAmount = item.tax_amount ?? (itemTaxEnabled ? item.line_subtotal * (itemTaxRate / 100) : 0);
      return {
        order_id: order.id,
        product_type: item.item_kind === "green_coffee" ? "green" : item.item_kind === "roast_service" ? "service" : "product",
        roast_batch_id: null,
        green_coffee_id: item.item_kind === "green_coffee" ? item.green_coffee_id || null : null,
        weight_grams: null,
        green_weight_kg: item.item_kind === "green_coffee" ? item.quantity : null,
        quantity: item.item_kind === "green_coffee" ? 1 : item.quantity,
        unit_price: item.unit_price,
        tax_rate: itemTaxRate,
        subtotal_amount: item.line_subtotal,
        tax_amount: itemTaxAmount,
        total_amount: item.line_total ?? item.line_subtotal + itemTaxAmount,
        notes: item.description,
      };
    });

    if (orderItems.length > 0) {
      const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        toast.error("Error al guardar los renglones de la venta");
        return;
      }
    }

    await supabase.from("quotations").update({
      status: "invoiced",
      converted_sale_id: order.id,
    }).eq("id", quote.id);

    toast.success("Venta creada desde la cotización");
    router.push("/sales");
  }

  if (loading) return <p className="text-sm text-text-secondary">Cargando cotización...</p>;
  if (!quote) return <p className="text-sm text-text-secondary">Cotización no encontrada</p>;

  const items = ((quote as any).quotation_items ?? []) as QuotationItem[];
  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="page-title">{quote.quote_number}</h1>
            <p className="text-sm text-text-secondary">
              {QUOTE_CATEGORY_LABELS[quote.category]} · {QUOTE_STATUS_LABELS[quote.status]}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {quote.status !== "accepted" && quote.status !== "invoiced" && (
            <button type="button" onClick={() => updateStatus("accepted")} className="btn-secondary">
              <CheckCircle className="w-4 h-4" /> Aceptada
            </button>
          )}
          {quote.status !== "rejected" && quote.status !== "invoiced" && (
            <button type="button" onClick={() => updateStatus("rejected")} className="btn-ghost text-status-danger hover:bg-red-50">
              <XCircle className="w-4 h-4" /> Rechazar
            </button>
          )}
          {quote.status !== "invoiced" && (
            <button type="button" onClick={convertToSale} className="btn-primary">
              <ShoppingBag className="w-4 h-4" /> Generar venta
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-default">
              <p className="text-sm font-semibold text-text-primary">Detalle cotizado</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default bg-[#F8FAFC]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Descripción</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Tipo</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Cant.</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Unitario</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">IVA</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b border-border-default last:border-0">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-text-primary">{item.description}</p>
                        {(item as any).green_coffees?.name && <p className="text-xs text-text-secondary">{(item as any).green_coffees.name}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary hidden md:table-cell">{QUOTE_KIND_LABELS[item.item_kind]}</td>
                      <td className="px-5 py-3.5 text-right font-mono">{item.quantity} {item.unit_label}</td>
                      <td className="px-5 py-3.5 text-right font-mono">{formatCurrency(item.unit_price, quote.currency)}</td>
                      <td className="px-5 py-3.5 text-right font-mono">{(item.tax_enabled ?? quote.tax_enabled) ? `${Number(item.tax_rate ?? quote.tax_rate ?? 0)}%` : "sin IVA"}</td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium">{formatCurrency(item.line_subtotal, quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-border-default bg-[#F8FAFC]">
                  <tr>
                    <td colSpan={5} className="px-5 py-2 text-right text-sm text-text-secondary">Subtotal</td>
                    <td className="px-5 py-2 text-right font-mono">{formatCurrency(quote.subtotal_amount, quote.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-5 py-2 text-right text-sm text-text-secondary">
                      IVA
                    </td>
                    <td className="px-5 py-2 text-right font-mono">{formatCurrency(quote.tax_amount, quote.currency)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-right text-sm font-semibold">Total</td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-text-primary">{formatCurrency(quote.total_amount, quote.currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <p className="section-title">Cliente</p>
            <p className="text-sm font-semibold text-text-primary">{quote.client_name ?? "Sin cliente"}</p>
            {quote.client_email && <p className="text-xs text-text-secondary mt-1">{quote.client_email}</p>}
          </div>
          <div className="card p-5">
            <p className="section-title">Fechas</p>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Emisión</dt>
                <dd className="font-medium">{formatDate(quote.quote_date)}</dd>
              </div>
              {quote.valid_until && (
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Válida hasta</dt>
                  <dd className="font-medium">{formatDate(quote.valid_until)}</dd>
                </div>
              )}
            </dl>
          </div>
          {quote.notes && (
            <div className="card p-5">
              <p className="section-title">Notas</p>
              <p className="text-sm text-text-secondary whitespace-pre-line">{quote.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
