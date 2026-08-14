import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatDate } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import type { Client } from "@/types";

const typeLabels: Record<string, string> = {
  cafe: "Cafeteria",
  individual: "Consumidor",
  restaurant: "Restaurante",
  distributor: "Distribuidor",
  other: "Otro",
};

const typeColors: Record<string, string> = {
  cafe: "bg-amber-50 text-amber-700 border-amber-200",
  individual: "bg-blue-50 text-blue-700 border-blue-200",
  restaurant: "bg-purple-50 text-purple-700 border-purple-200",
  distributor: "bg-green-50 text-green-700 border-green-200",
  other: "bg-gray-100 text-gray-600 border-gray-200",
};

type ClientOrder = {
  client_id: string | null;
  client_name: string | null;
  total_amount: number | null;
  order_date: string;
};

function normalizeClientName(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();
  if (!roaster) redirect("/onboarding");

  const { data: clients } = await supabase
    .from("clients")
    .select("*")
    .eq("roaster_id", roaster.id)
    .order("name");

  const { data: orders } = await supabase
    .from("orders")
    .select("client_id, client_name, total_amount, order_date")
    .eq("roaster_id", roaster.id)
    .neq("status", "cancelled");

  const salesByClient: Record<string, { total: number; lastDate: string; count: number }> = {};
  const clientIdsByName = new Map<string, string>();
  (clients ?? []).forEach((client: Client) => {
    clientIdsByName.set(normalizeClientName(client.name), client.id);
  });

  ((orders ?? []) as ClientOrder[]).forEach((order) => {
    const clientKey = order.client_id ?? clientIdsByName.get(normalizeClientName(order.client_name));
    if (!clientKey) return;
    if (!salesByClient[clientKey]) {
      salesByClient[clientKey] = { total: 0, lastDate: order.order_date, count: 0 };
    }
    salesByClient[clientKey].total += Number(order.total_amount ?? 0);
    salesByClient[clientKey].count += 1;
    if (order.order_date > salesByClient[clientKey].lastDate) {
      salesByClient[clientKey].lastDate = order.order_date;
    }
  });

  const today = new Date();
  const inactiveClients = (clients ?? []).filter((client: Client) => {
    const stats = salesByClient[client.id];
    if (!stats) return true;
    const daysSince = differenceInDays(today, parseISO(stats.lastDate));
    return daysSince >= client.inactive_alert_days;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Clientes</h1>
        <Link href="/clients/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Agregar cliente
        </Link>
      </div>

      {inactiveClients.length > 0 && (
        <div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-status-warning" />
            <span className="text-sm font-medium text-status-warning">
              {inactiveClients.length} cliente{inactiveClients.length > 1 ? "s" : ""} sin compras recientes
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {inactiveClients.map((client: Client) => {
              const stats = salesByClient[client.id];
              const daysSince = stats ? differenceInDays(today, parseISO(stats.lastDate)) : null;
              return (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span className="mr-1">-</span>
                  <span className="font-medium">{client.name}</span>{" "}
                  {daysSince !== null ? `hace ${daysSince} dias sin comprar` : "nunca registro una compra"}{" "}
                  (alerta cada {client.inactive_alert_days} dias)
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {(clients ?? []).length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="No hay clientes registrados"
            description="Agrega tus clientes para trackear sus compras y recibir alertas de inactividad."
            actionLabel="+ Agregar cliente"
            actionHref="/clients/new"
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Tipo</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Compras</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Ultima compra</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(clients ?? []).map((client: Client) => {
                  const stats = salesByClient[client.id];
                  const daysSince = stats ? differenceInDays(today, parseISO(stats.lastDate)) : null;
                  const isInactive = inactiveClients.some((entry: Client) => entry.id === client.id);

                  return (
                    <tr key={client.id} className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-text-primary group-hover:text-accent-green transition-colors"
                        >
                          {client.name}
                        </Link>
                        {client.phone && <p className="text-xs text-text-secondary mt-0.5">{client.phone}</p>}
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${typeColors[client.type] ?? typeColors.other}`}>
                          {typeLabels[client.type] ?? client.type}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-text-secondary hidden md:table-cell">
                        {stats?.count ?? 0}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary">
                        {stats ? formatCurrency(stats.total, roaster.currency) : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right text-text-secondary hidden sm:table-cell">
                        {stats ? (
                          <span className={daysSince !== null && daysSince >= client.inactive_alert_days ? "text-status-warning font-medium" : ""}>
                            {formatDate(stats.lastDate)}
                          </span>
                        ) : "-"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {isInactive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-status-warning font-medium">
                            <AlertTriangle className="w-3 h-3" />
                            Inactivo
                          </span>
                        ) : (
                          <span className="text-xs text-status-success font-medium">Activo</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
