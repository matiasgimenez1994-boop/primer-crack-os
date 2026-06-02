import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import {
  Leaf,
  Flame,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Plus,
  ClipboardList,
} from"lucide-react";
import { StatsCard } from"@/components/ui/StatsCard";
import { StatusBadge } from"@/components/ui/StatusBadge";
import { ShrinkageIndicator } from"@/components/ui/ShrinkageIndicator";
import {
  formatCurrency,
  formatWeight,
  formatDate,
  currentMonthRange,
} from"@/lib/utils";
import { calculateCosts, calculateMargin } from"@/lib/costs";
import { differenceInDays, parseISO } from"date-fns";
import type { RoastBatch, GreenCoffee, Client, Order } from"@/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!roaster) redirect("/onboarding");

  const { start, end } = currentMonthRange();

  const [
    { data: coffees },
    { data: recentBatches },
    { data: monthBatches },
    { data: clients },
    { data: clientSales },
    { data: activeOrders },
  ] = await Promise.all([
    supabase
      .from("green_coffees")
      .select("*")
      .eq("roaster_id", roaster.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("roast_batches")
      .select("*, green_coffees(name, purchase_price_per_kg)")
      .eq("roaster_id", roaster.id)
      .order("roast_date", { ascending: false })
      .limit(5),
    supabase
      .from("roast_batches")
      .select("roasted_weight_kg, total_cost_per_kg_roasted")
      .eq("roaster_id", roaster.id)
      .gte("roast_date", start)
      .lte("roast_date", end),
    supabase
      .from("clients")
      .select("*")
      .eq("roaster_id", roaster.id),
    supabase
      .from("sales")
      .select("client_id, sale_date")
      .eq("roaster_id", roaster.id)
      .not("client_id","is", null),
    supabase
      .from("orders")
      .select("*, clients(name)")
      .eq("roaster_id", roaster.id)
      .in("status", ["pending","roasting","ready"])
      .order("delivery_date", { ascending: true }),
  ]);

  // Clientes inactivos
  const lastSaleByClient: Record<string, string> = {};
  (clientSales ?? []).forEach((s: { client_id: string; sale_date: string }) => {
    if (!lastSaleByClient[s.client_id] || s.sale_date > lastSaleByClient[s.client_id]) {
      lastSaleByClient[s.client_id] = s.sale_date;
    }
  });
  const today = new Date();
  const inactiveClients = (clients ?? []).filter((c: Client) => {
    const last = lastSaleByClient[c.id];
    if (!last) return true;
    return differenceInDays(today, parseISO(last)) >= c.inactive_alert_days;
  });

  const totalGreenStock = (coffees ?? []).reduce((sum: number, c: GreenCoffee) => sum + c.current_stock_kg,
    0);

  const inventoryValue = (coffees ?? []).reduce((sum: number, c: GreenCoffee) =>
      sum + c.current_stock_kg * c.purchase_price_per_kg,
    0);

  const kgRoastedMonth = (monthBatches ?? []).reduce((sum: number, b: { roasted_weight_kg: number }) =>
      sum + b.roasted_weight_kg,
    0);

  const lowStockCoffees = (coffees ?? []).filter((c: GreenCoffee) =>
      c.current_stock_kg <= roaster.low_stock_threshold &&
      c.status !=="depleted");

  // Calcular margen promedio de los últimos tuestes
  const avgMargin =
    (recentBatches ?? []).length > 0
      ? (recentBatches ?? []).reduce((sum: number, b: RoastBatch) => {
          if (!b.total_cost_per_kg_roasted) return sum;
          const m = calculateMargin(b.total_cost_per_kg_roasted * 1.4,
            1000,
            b.total_cost_per_kg_roasted);
          return sum + m.marginPct;
        }, 0) / (recentBatches ?? []).length
      : 0;

  return (<div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          {roaster.logo_url && (
            <img
              src={roaster.logo_url}
              alt={roaster.business_name}
              className="w-12 h-12 rounded-xl object-contain border border-border-default bg-white p-1"
            />
          )}
          <div>
            <h1 className="page-title">{roaster.business_name}</h1>
            <p className="text-sm text-text-secondary">
              {new Date().toLocaleDateString("es-UY", {
                weekday:"long",
                day:"numeric",
                month:"long",
                year:"numeric",
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/inventory/new" className="btn-secondary hidden sm:flex">
            <Leaf className="w-4 h-4" /> Café verde
          </Link>
          <Link href="/roasts/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Tueste
          </Link>
        </div>
      </div>

      {/* Alertas */}
      {lowStockCoffees.length > 0 && (<div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-status-warning" />
            <span className="text-sm font-medium text-status-warning">
              Stock bajo
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {lowStockCoffees.map((c: GreenCoffee) => (<Link
                key={c.id}
                href={`/inventory/${c.id}`}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                · {c.name} ""{""}
                <span className="font-mono font-medium">
                  {formatWeight(c.current_stock_kg)} restantes
                </span>
              </Link>))}
          </div>
        </div>)}

      {/* Alertas clientes inactivos */}
      {inactiveClients.length > 0 && (<div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">
              Clientes sin compras recientes
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {inactiveClients.slice(0, 3).map((c: Client) => {
              const last = lastSaleByClient[c.id];
              const days = last ? differenceInDays(today, parseISO(last)) : null;
              return (<Link key={c.id} href={`/clients/${c.id}`}
                  className="text-sm text-blue-700 hover:text-blue-900 transition-colors"
                >
                  · <span className="font-medium">{c.name}</span> ""{""}
                  {days !== null ? `hace ${days} días sin comprar` :"sin compras registradas"}
                </Link>);
            })}
            {inactiveClients.length > 3 && (<Link href="/clients" className="text-xs text-blue-600 hover:underline mt-1">
                Ver todos ({inactiveClients.length})
              </Link>)}
          </div>
        </div>)}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <StatsCard
          icon={Leaf}
          label="Stock verde"
          value={`${totalGreenStock.toFixed(1)} kg`}
          sub={`${(coffees ?? []).filter((c: GreenCoffee) => c.status ==="active").length} cafés activos`}
        />
        <StatsCard
          icon={Flame}
          label="Tostado este mes"
          value={`${kgRoastedMonth.toFixed(1)} kg`}
        />
        <StatsCard
          icon={DollarSign}
          label="Valor inventario"
          value={formatCurrency(inventoryValue, roaster.currency)}
        />
        <StatsCard
          icon={TrendingUp}
          label="Alertas"
          value={`${lowStockCoffees.length}`}
          alert={lowStockCoffees.length > 0}
          sub={lowStockCoffees.length > 0 ?"cafés con bajo stock" :"todo OK"}
        />
      </div>

      {/* Pedidos activos */}
      {(activeOrders ?? []).length > 0 && (<div className="card overflow-hidden mb-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-accent-green" />
              <h2 className="text-sm font-semibold text-text-primary">
                Pedidos activos ({(activeOrders ?? []).length})
              </h2>
            </div>
            <Link href="/orders" className="text-xs text-accent-green hover:underline font-medium">Ver todos</Link>
          </div>
          <div className="divide-y divide-border-default">
            {(activeOrders ?? []).slice(0, 4).map((o: Order) => {
              const STATUS_LABELS: Record<string, string> = { pending:"Pendiente", roasting:"Tostando", ready:"Listo" };
              const STATUS_COLORS: Record<string, string> = { pending:"text-yellow-700 bg-yellow-50 border-yellow-200", roasting:"text-orange-700 bg-orange-50 border-orange-200", ready:"text-status-success bg-green-50 border-green-200" };
              const isOverdue = o.delivery_date && o.delivery_date < today.toISOString().split("T")[0];
              return (<Link key={o.id} href={`/orders/${o.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-[#F5EFE6]/50 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-text-primary">
                      {(o as any).clients?.name ?? o.client_name ??"Sin cliente"}
                    </p>
                    {o.delivery_date && (<p className={`text-xs mt-0.5 ${isOverdue ?"text-status-danger font-medium" :"text-text-secondary"}`}>
                        Entrega: {formatDate(o.delivery_date)}{isOverdue ?" š ï¸" :""}
                      </p>)}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${STATUS_COLORS[o.status]}`}>
                    {STATUS_LABELS[o.status]}
                  </span>
                </Link>);
            })}
          </div>
        </div>)}

      {/* íšltimos tuestes */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            íšltimos tuestes
          </h2>
          <Link
            href="/roasts"
            className="text-xs text-accent-green hover:underline font-medium"
          >
            Ver todos
          </Link>
        </div>

        {(recentBatches ?? []).length === 0 ? (<div className="py-12 text-center">
            <Flame className="w-8 h-8 text-border-default mx-auto mb-3" />
            <p className="text-sm text-text-secondary">
              Todavía no hay tuestes registrados
            </p>
            <Link href="/roasts/new" className="btn-primary mt-4 inline-flex">
              Registrar primer tueste
            </Link>
          </div>) : (<div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary">
                    Café
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary hidden sm:table-cell">
                    Fecha
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                    Lote
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary hidden md:table-cell">
                    Merma
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                    Costo/kg
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary hidden sm:table-cell">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {(recentBatches ?? []).map((b: RoastBatch) => (<tr
                    key={b.id}
                    className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/roasts/${b.id}`}
                        className="font-medium text-text-primary hover:text-accent-green transition-colors"
                      >
                        {b.green_coffees?.name ?? "-"}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-text-secondary hidden sm:table-cell">
                      {formatDate(b.roast_date)}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-text-primary">
                      {formatWeight(b.roasted_weight_kg)}
                    </td>
                    <td className="px-5 py-3 text-right hidden md:table-cell">
                      <ShrinkageIndicator pct={b.shrinkage_pct} />
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-text-primary">
                      {b.total_cost_per_kg_roasted
                        ? formatCurrency(b.total_cost_per_kg_roasted, roaster.currency)
                        : "-"}
                    </td>
                    <td className="px-5 py-3 text-right hidden sm:table-cell">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}
      </div>

      {/* Inventario rápido */}
      {(coffees ?? []).length > 0 && (<div className="card overflow-hidden mt-4">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
            <h2 className="text-sm font-semibold text-text-primary">
              Inventario de café verde
            </h2>
            <Link
              href="/inventory"
              className="text-xs text-accent-green hover:underline font-medium"
            >
              Ver todo
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary">
                    Café
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary hidden sm:table-cell">
                    Origen
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                    Stock
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {(coffees ?? []).slice(0, 5).map((c: GreenCoffee) => (<tr
                    key={c.id}
                    className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/inventory/${c.id}`}
                        className="font-medium text-text-primary hover:text-accent-green transition-colors"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-text-secondary hidden sm:table-cell">
                      {c.origin_country ?? "-"}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-text-primary">
                      {formatWeight(c.current_stock_kg)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
}

