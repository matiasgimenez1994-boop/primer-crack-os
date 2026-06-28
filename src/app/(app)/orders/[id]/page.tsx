"use client";

import { useEffect, useState } from"react";
import { useParams, useRouter } from"next/navigation";
import Link from"next/link";
import {
  ArrowLeft, CheckCircle, Flame, Package,
  Truck, XCircle, ShoppingBag, Clock, AlertTriangle, FileText,
  type LucideIcon,
} from"lucide-react";
import { createClient } from"@/lib/supabase/client";
import { formatCurrency, formatDate, todayISO } from"@/lib/utils";
import { toast } from"sonner";
import { differenceInDays, parseISO } from"date-fns";
import type { Order, OrderItem, Roaster } from"@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: LucideIcon }> = {
  draft:     { label:"Borrador",   color:"text-text-secondary",  bg:"bg-gray-100",   border:"border-gray-200",    icon: FileText },
  proforma:  { label:"Proforma",   color:"text-blue-700",       bg:"bg-blue-50",    border:"border-blue-200",    icon: FileText },
  pending:   { label:"Pendiente",  color:"text-yellow-700",     bg:"bg-yellow-50",  border:"border-yellow-200",  icon: Clock },
  confirmed: { label:"Confirmado", color:"text-status-success",  bg:"bg-green-50",   border:"border-green-200",   icon: CheckCircle },
  roasting:  { label:"Tostando",   color:"text-orange-700",     bg:"bg-orange-50",  border:"border-orange-200",  icon: Flame },
  ready:     { label:"Listo",      color:"text-status-success",  bg:"bg-green-50",   border:"border-green-200",   icon: Package },
  delivered: { label:"Entregado",  color:"text-text-secondary",  bg:"bg-gray-100",   border:"border-gray-200",    icon: Truck },
  cancelled: { label:"Cancelado",  color:"text-status-danger",   bg:"bg-red-50",     border:"border-red-200",     icon: XCircle },
};

const FALLBACK_STATUS = STATUS_CONFIG.pending;

const NEXT_STATUS: Record<string, string> = {
  pending:"roasting",
  roasting:"ready",
  ready:"delivered",
};

const NEXT_LABEL: Record<string, string> = {
  pending:" Empezar tueste",
  roasting:" Marcar listo",
  ready:" Marcar entregado",
};

const WEIGHT_LABELS: Record<number, string> = { 250:"250g", 500:"500g", 1000:"1kg" };

export default function OrderDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = createClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: r } = await supabase.from("roasters").select("*").eq("user_id", user.id).single();
    if (!r) return;
    setRoaster(r);
    const { data: o } = await supabase
      .from("orders")
      .select("*, clients(name, phone, email), order_items(*, green_coffees(name))")
      .eq("id", id).eq("roaster_id", r.id).single();
    if (o) setOrder(o);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function advanceStatus() {
    if (!order || !NEXT_STATUS[order.status]) return;
    const next = NEXT_STATUS[order.status];
    const { error } = await supabase.from("orders")
      .update({ status: next }).eq("id", id);
    if (error) { toast.error("Error al actualizar"); return; }
    toast.success(`Pedido marcado como: ${(STATUS_CONFIG[next] ?? FALLBACK_STATUS).label}`);
    load();
  }

  async function cancelOrder() {
    if (!confirm("¿Cancelar este pedido?")) return;
    await supabase.from("orders").update({ status:"cancelled" }).eq("id", id);
    toast.success("Pedido cancelado");
    load();
  }

  async function convertToSale() {
    if (!order || !roaster) return;
    if (!confirm("¿Convertir este pedido en una venta? Se creará una venta por el total del pedido.")) return;

    const { error } = await supabase.from("sales").insert({
      roaster_id: roaster.id,
      client_id: order.client_id,
      client_name: order.client_name,
      sale_date: todayISO(),
      product_type: "roasted",
      quantity: 1,
      unit_price: order.total_amount,
      discount_pct: 0,
      final_price: order.total_amount,
      cost_per_unit: 0,
      profit: 0,
      payment_type: "cash",
      payment_status: "paid",
      amount_paid: order.total_amount,
      paid_at: new Date().toISOString(),
      notes: `Pedido #${id.slice(0, 8)}`,
    });

    if (error) { toast.error("Error al crear la venta"); return; }
    await supabase.from("orders").update({ status:"delivered" }).eq("id", id);
    toast.success("Venta registrada y pedido marcado como entregado");
    router.push("/sales");
  }

  if (loading) return (<div className="flex items-center justify-center min-h-[300px]">
      <div className="w-6 h-6 border-2 border-border-default border-t-accent-terra rounded-full animate-spin" />
    </div>);

  if (!order) return <p className="text-text-secondary p-8">Pedido no encontrado</p>;

  const cfg = STATUS_CONFIG[order.status] ?? FALLBACK_STATUS;
  const StatusIcon = cfg.icon;
  const isActive = !["delivered","cancelled"].includes(order.status);
  const isOverdue = order.delivery_date && order.delivery_date < todayISO() && isActive;
  const daysUntilDelivery = order.delivery_date
    ? differenceInDays(parseISO(order.delivery_date), new Date())
    : null;
  const items: OrderItem[] = (order as any).order_items ?? [];
  const client = (order as any).clients;

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">
              {client?.name ?? order.client_name ??"Sin cliente"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                <StatusIcon className="w-3 h-3" />{cfg.label}
              </span>
              <span className="text-xs text-text-secondary">#{id.slice(0,8)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isActive && NEXT_STATUS[order.status] && (<button onClick={advanceStatus} className="btn-primary text-xs">
              {NEXT_LABEL[order.status]}
            </button>)}
          {order.status ==="ready" && (<button onClick={convertToSale} className="btn-secondary text-xs">
              <ShoppingBag className="w-3.5 h-3.5" /> Registrar venta
            </button>)}
          {isActive && order.status !=="cancelled" && (<button onClick={cancelOrder}
              className="btn-ghost text-xs text-status-danger hover:bg-red-50">
              <XCircle className="w-3.5 h-3.5" /> Cancelar
            </button>)}
        </div>
      </div>

      {/* Alerta vencimiento */}
      {isOverdue && (<div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-danger shrink-0" />
          <p className="text-sm text-status-danger font-medium">
            Entrega vencida hace {Math.abs(daysUntilDelivery ?? 0)} días
          </p>
        </div>)}

      {/* Timeline de estado */}
      <div className="card p-5 mb-5">
        <div className="flex items-center gap-0">
          {["pending","confirmed","roasting","ready","delivered"].map((s, i, arr) => {
            const scfg = STATUS_CONFIG[s];
            const SIcon = scfg.icon;
            const flowIndex = ["pending","confirmed","roasting","ready","delivered"].indexOf(order.status);
            const isCurrentOrPast = flowIndex >= 0 && flowIndex >= i && order.status !=="cancelled";
            const isCurrent = order.status === s;
            return (<div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`flex flex-col items-center gap-1 ${isCurrent ?"scale-110" :""}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCurrent ? `${scfg.bg} ${scfg.border} ${scfg.color}` :
                    isCurrentOrPast ?"bg-status-success border-status-success text-white" :"bg-[#FDFAF6] border-border-default text-text-secondary"
                  }`}>
                    <SIcon className="w-4 h-4" />
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${isCurrent ? scfg.color : isCurrentOrPast ?"text-status-success" :"text-text-secondary"}`}>
                    {scfg.label}
                  </span>
                </div>
                {i < arr.length - 1 && (<div className={`flex-1 h-0.5 mx-1 ${isCurrentOrPast && order.status !== s ?"bg-status-success" :"bg-border-default"}`} />)}
              </div>);
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border-default">
              <p className="text-sm font-semibold text-text-primary">Productos del pedido</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Producto</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Cant.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Precio</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: OrderItem) => {
                  const coffeeName = (item as any).green_coffees?.name ??"—";
                  const desc = item.product_type ==="roasted"
                    ? `${coffeeName} · ${WEIGHT_LABELS[item.weight_grams!] ?? item.weight_grams +"g"}`
                    : `${coffeeName} · Verde ${item.green_weight_kg}kg`;
                  return (<tr key={item.id} className="border-b border-border-default last:border-0">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-text-primary">{desc}</p>
                        {item.notes && <p className="text-xs text-text-secondary mt-0.5">{item.notes}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">{item.quantity}</td>
                      <td className="px-5 py-3.5 text-right font-mono text-text-secondary">
                        {formatCurrency(item.unit_price, roaster?.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-text-primary">
                        {formatCurrency(item.unit_price * item.quantity, roaster?.currency)}
                      </td>
                    </tr>);
                })}
              </tbody>
              <tfoot className="border-t-2 border-border-default bg-[#FDFAF6]">
                <tr>
                  <td colSpan={3} className="px-5 py-3 text-sm font-semibold text-text-secondary text-right">Total</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-accent-terra text-base">
                    {formatCurrency(order.total_amount, roaster?.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Info lateral */}
        <div className="flex flex-col gap-4">
          <div className="card p-5">
            <p className="section-title">Fechas</p>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Fecha pedido</dt>
                <dd className="font-medium">{formatDate(order.order_date)}</dd>
              </div>
              {order.delivery_date && (<div className="flex justify-between">
                  <dt className="text-text-secondary">Entrega</dt>
                  <dd className={`font-medium ${isOverdue ?"text-status-danger" :""}`}>
                    {formatDate(order.delivery_date)}
                    {daysUntilDelivery !== null && !isOverdue && daysUntilDelivery <= 3 && (<span className="text-xs text-status-warning ml-1">(en {daysUntilDelivery}d)</span>)}
                  </dd>
                </div>)}
            </dl>
          </div>

          {client && (<div className="card p-5">
              <p className="section-title">Cliente</p>
              <Link href={`/clients/${order.client_id}`}
                className="font-semibold text-text-primary hover:text-accent-terra transition-colors text-sm">
                {client.name}
              </Link>
              {client.phone && (<a href={`https://wa.me/${client.phone.replace(/\D/g,"")}`} target="_blank"
                  className="block text-xs text-accent-terra hover:underline mt-1">
                   {client.phone}
                </a>)}
              {client.email && (<a href={`mailto:${client.email}`}
                  className="block text-xs text-accent-terra hover:underline mt-0.5">
                  ️ {client.email}
                </a>)}
            </div>)}

          {order.notes && (<div className="card p-5">
              <p className="section-title">Notas</p>
              <p className="text-sm text-text-secondary">{order.notes}</p>
            </div>)}
        </div>
      </div>
    </div>);
}
