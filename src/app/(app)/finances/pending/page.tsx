"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, todayISO } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import type { Sale, Roaster } from "@/types";

const weightLabels: Record<number, string> = { 250: "250g", 500: "500g", 1000: "1kg" };

export default function PendingPaymentsPage() {
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(roasterId: string) {
    const { data } = await supabase
      .from("sales")
      .select("*, clients(name), roast_batches(green_coffees(name)), green_coffees(name)")
      .eq("roaster_id", roasterId)
      .in("payment_status", ["pending", "partial"])
      .order("sale_date", { ascending: true });
    setSales(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("*").eq("user_id", user.id).single()
        .then(({ data: r }) => {
          if (!r) return;
          setRoaster(r);
          load(r.id);
        });
    });
  }, []);

  async function markAsPaid(sale: Sale, paymentType: string) {
    if (!roaster) return;
    const remaining = sale.final_price - sale.amount_paid;

    const { error: payError } = await supabase.from("payments").insert({
      roaster_id: roaster.id,
      sale_id: sale.id,
      amount: remaining,
      payment_type: paymentType,
      paid_at: new Date().toISOString(),
    });

    if (payError) { toast.error("Error al registrar pago"); return; }

    await supabase.from("sales").update({
      payment_status: "paid",
      amount_paid: sale.final_price,
      paid_at: new Date().toISOString(),
    }).eq("id", sale.id);

    toast.success("Pago registrado âœ“");
    load(roaster.id);
  }

  async function markPartial(sale: Sale, amount: number, paymentType: string) {
    if (!roaster || amount <= 0) return;
    const newPaid = sale.amount_paid + amount;
    const status = newPaid >= sale.final_price ? "paid" : "partial";

    await supabase.from("payments").insert({
      roaster_id: roaster.id,
      sale_id: sale.id,
      amount,
      payment_type: paymentType,
      paid_at: new Date().toISOString(),
    });

    await supabase.from("sales").update({
      payment_status: status,
      amount_paid: Math.min(newPaid, sale.final_price),
      paid_at: status === "paid" ? new Date().toISOString() : null,
    }).eq("id", sale.id);

    toast.success("Pago parcial registrado");
    load(roaster.id);
  }

  const totalPending = sales.reduce((s, x) => s + (x.final_price - x.amount_paid), 0);
  const overdue = sales.filter(s => s.due_date && parseISO(s.due_date) < new Date());

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-6 h-6 border-2 border-border-default border-t-accent-green rounded-full animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/finances" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="page-title">Pagos pendientes</h1>
            {sales.length > 0 && (
              <p className="text-sm text-text-secondary">
                {sales.length} venta{sales.length > 1 ? "s" : ""} · Total pendiente:{" "}
                <span className="font-mono font-semibold text-status-danger">
                  {formatCurrency(totalPending, roaster?.currency)}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-status-danger" />
            <span className="text-sm font-semibold text-status-danger">
              {overdue.length} pago{overdue.length > 1 ? "s" : ""} vencido{overdue.length > 1 ? "s" : ""}
            </span>
          </div>
          {overdue.map(s => (
            <p key={s.id} className="text-xs text-status-danger ml-6">
              · {(s as any).clients?.name ?? "Sin cliente"} â€” vencido hace{" "}
              {differenceInDays(new Date(), parseISO(s.due_date!))} días
            </p>
          ))}
        </div>
      )}

      {sales.length === 0 ? (
        <div className="card p-12 text-center">
          <CheckCircle className="w-12 h-12 text-status-success mx-auto mb-3" />
          <p className="text-base font-semibold text-text-primary">Todo al día</p>
          <p className="text-sm text-text-secondary mt-1">No hay pagos pendientes</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {sales.map(s => {
            const remaining = s.final_price - s.amount_paid;
            const isOverdue = s.due_date && parseISO(s.due_date) < new Date();
            const daysUntilDue = s.due_date
              ? differenceInDays(parseISO(s.due_date), new Date())
              : null;
            const productName = s.product_type === "roasted"
              ? `${(s as any).roast_batches?.green_coffees?.name} ${weightLabels[s.weight_grams!] ?? ""}`
              : `${(s as any).green_coffees?.name} (verde)`;

            return (
              <PartialPayCard
                key={s.id}
                sale={s}
                productName={productName}
                remaining={remaining}
                isOverdue={!!isOverdue}
                daysUntilDue={daysUntilDue}
                currency={roaster?.currency ?? "USD"}
                onMarkPaid={markAsPaid}
                onPartialPay={markPartial}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function PartialPayCard({
  sale, productName, remaining, isOverdue, daysUntilDue, currency, onMarkPaid, onPartialPay,
}: {
  sale: Sale;
  productName: string;
  remaining: number;
  isOverdue: boolean;
  daysUntilDue: number | null;
  currency: string;
  onMarkPaid: (sale: Sale, type: string) => void;
  onPartialPay: (sale: Sale, amount: number, type: string) => void;
}) {
  const [showPartial, setShowPartial] = useState(false);
  const [partialAmount, setPartialAmount] = useState("");
  const [payType, setPayType] = useState("cash");
  const paidPct = sale.final_price > 0 ? (sale.amount_paid / sale.final_price) * 100 : 0;

  return (
    <div className={`card p-5 ${isOverdue ? "border-red-200 bg-red-50/30" : ""}`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            {isOverdue
              ? <AlertTriangle className="w-4 h-4 text-status-danger shrink-0" />
              : <Clock className="w-4 h-4 text-status-warning shrink-0" />
            }
            <span className="font-semibold text-text-primary">{(sale as any).clients?.name ?? "Sin cliente"}</span>
            {sale.payment_status === "partial" && (
              <span className="text-xs bg-yellow-100 text-yellow-700 border border-yellow-200 px-1.5 py-0.5 rounded">
                Pago parcial
              </span>
            )}
          </div>
          <p className="text-sm text-text-secondary ml-6">{productName} · {formatDate(sale.sale_date)}</p>
          {sale.due_date && (
            <p className={`text-xs ml-6 mt-0.5 font-medium ${isOverdue ? "text-status-danger" : "text-status-warning"}`}>
              {isOverdue
                ? `Vencido hace ${Math.abs(daysUntilDue ?? 0)} días`
                : `Vence en ${daysUntilDue} días (${formatDate(sale.due_date)})`
              }
            </p>
          )}

          {/* Barra de progreso */}
          {sale.amount_paid > 0 && (
            <div className="ml-6 mt-2">
              <div className="flex justify-between text-xs text-text-secondary mb-1">
                <span>Pagado: {formatCurrency(sale.amount_paid, currency)}</span>
                <span>Pendiente: {formatCurrency(remaining, currency)}</span>
              </div>
              <div className="h-1.5 bg-border-default rounded-full overflow-hidden">
                <div className="h-full bg-accent-olive rounded-full" style={{ width: `${paidPct}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-text-secondary">Pendiente</p>
          <p className="text-xl font-mono font-bold text-status-danger">
            {formatCurrency(remaining, currency)}
          </p>
          <p className="text-xs text-text-secondary">de {formatCurrency(sale.final_price, currency)}</p>
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-4 pt-4 border-t border-border-default flex flex-col gap-3">
        <div className="flex gap-2">
          <select
            value={payType}
            onChange={e => setPayType(e.target.value)}
            className="input-base text-xs py-1.5 flex-1"
          >
            <option value="cash">ðŸ’µ Efectivo</option>
            <option value="transfer">ðŸ¦ Transferencia</option>
          </select>
          <button
            onClick={() => onMarkPaid(sale, payType)}
            className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Marcar pagado
          </button>
          <button
            onClick={() => setShowPartial(!showPartial)}
            className="btn-secondary text-xs py-1.5 px-3 whitespace-nowrap"
          >
            Pago parcial
          </button>
        </div>

        {showPartial && (
          <div className="flex gap-2 items-center bg-[#F5EFE6] rounded-lg p-3">
            <span className="text-xs text-text-secondary shrink-0">Monto a cobrar:</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={remaining}
              placeholder="0.00"
              value={partialAmount}
              onChange={e => setPartialAmount(e.target.value)}
              className="input-base font-mono text-sm py-1.5 flex-1"
            />
            <button
              onClick={() => {
                const amt = parseFloat(partialAmount);
                if (amt > 0) {
                  onPartialPay(sale, amt, payType);
                  setPartialAmount("");
                  setShowPartial(false);
                }
              }}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Registrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

