import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { Plus, ClipboardList, AlertTriangle } from"lucide-react";
import { EmptyState } from"@/components/ui/EmptyState";
import { formatCurrency, formatDate, todayISO } from"@/lib/utils";
import { differenceInDays, parseISO } from"date-fns";
import type { Order } from"@/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label:"Pendiente",  color:"text-yellow-700",  bg:"bg-yellow-50",  border:"border-yellow-200" },
  roasting:  { label:"Tostando",   color:"text-orange-700",  bg:"bg-orange-50",  border:"border-orange-200" },
  ready:     { label:"Listo",      color:"text-status-success", bg:"bg-green-50", border:"border-green-200" },
  delivered: { label:"Entregado",  color:"text-text-secondary", bg:"bg-gray-100", border:"border-gray-200" },
  cancelled: { label:"Cancelado",  color:"text-status-danger",  bg:"bg-red-50",   border:"border-red-200" },
};

const STATUS_ORDER = ["pending","roasting","ready","delivered","cancelled"];

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("id, currency").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { data: orders } = await supabase
    .from("orders")
    .select("*, clients(name), order_items(id, quantity, unit_price)")
    .eq("roaster_id", roaster.id)
    .order("order_date", { ascending: false });

  const active = (orders ?? []).filter((o: Order) =>
    !["delivered","cancelled"].includes(o.status));
  const today = todayISO();
  const overdue = active.filter((o: Order) =>
    o.delivery_date && o.delivery_date < today && o.status !=="delivered");

  // Contadores por estado
  const counts: Record<string, number> = {};
  (orders ?? []).forEach((o: Order) => {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  });

  return (<div>
      <div className="page-header">
        <h1 className="text-xl font-semibold text-text-primary">Pedidos</h1>
        <Link href="/orders/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo pedido
        </Link>
      </div>

      {/* Stats rápidas */}
      <div className="flex gap-2 flex-wrap mb-5">
        {STATUS_ORDER.filter(s => counts[s]).map(s => {
          const cfg = STATUS_CONFIG[s];
          return (<div key={s} className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${cfg.bg} ${cfg.color} ${cfg.border}`}>
              {cfg.label}: {counts[s]}
            </div>);
        })}
      </div>

      {/* Alertas entregas vencidas */}
      {overdue.length > 0 && (<div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-status-danger" />
            <span className="text-sm font-semibold text-status-danger">
              {overdue.length} pedido{overdue.length > 1 ?"s" :""} con entrega vencida
            </span>
          </div>
          {overdue.map((o: Order) => (<Link key={o.id} href={`/orders/${o.id}`}
              className="block text-xs text-status-danger ml-6 hover:underline">
              · {(o as any).clients?.name ?? o.client_name ??"Sin cliente"} "”
              vencido hace {differenceInDays(new Date(), parseISO(o.delivery_date!))} días
            </Link>))}
        </div>)}

      {(orders ?? []).length === 0 ? (<div className="card">
          <EmptyState icon={ClipboardList} title="No hay pedidos"
            description="Registrá los pedidos de tus clientes para hacer un seguimiento desde que piden hasta que entregan."
            actionLabel="+ Nuevo pedido" actionHref="/orders/new" />
        </div>) : (<div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Pedido</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Entrega</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Items</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((o: Order) => {
                  const cfg = STATUS_CONFIG[o.status];
                  const isOverdue = o.delivery_date && o.delivery_date < today && !["delivered","cancelled"].includes(o.status);
                  const itemCount = (o as any).order_items?.length ?? 0;
                  return (<tr key={o.id}
                      className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link href={`/orders/${o.id}`}
                          className="font-medium text-text-primary group-hover:text-accent-green transition-colors">
                          {(o as any).clients?.name ?? o.client_name ??"Sin cliente"}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary hidden sm:table-cell">
                        {formatDate(o.order_date)}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        {o.delivery_date ? (<span className={isOverdue ?"text-status-danger font-medium" :"text-text-secondary"}>
                            {formatDate(o.delivery_date)}
                            {isOverdue &&" š ï¸"}
                          </span>) : <span className="text-text-secondary">"”</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-text-secondary hidden md:table-cell">
                        {itemCount}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary">
                        {o.total_amount > 0 ? formatCurrency(o.total_amount, roaster.currency) :""”"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>);
                })}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
}

