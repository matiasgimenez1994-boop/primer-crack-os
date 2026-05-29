import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { Plus, ShoppingBag, TrendingUp, DollarSign, Package } from"lucide-react";
import { EmptyState } from"@/components/ui/EmptyState";
import { StatsCard } from"@/components/ui/StatsCard";
import { formatCurrency, formatDate, formatWeight } from"@/lib/utils";
import { currentMonthRange } from"@/lib/utils";
import type { Sale } from"@/types";

const weightLabels: Record<number, string> = {
  250:"250 g",
  500:"500 g",
  1000:"1 kg",
};

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();
  if (!roaster) redirect("/onboarding");

  const { start } = currentMonthRange();

  const [{ data: sales }, { data: monthSales }] = await Promise.all([
    supabase
      .from("sales")
      .select("*, roast_batches(green_coffees(name)), green_coffees(name)")
      .eq("roaster_id", roaster.id)
      .order("sale_date", { ascending: false }),
    supabase
      .from("sales")
      .select("final_price, profit, quantity")
      .eq("roaster_id", roaster.id)
      .gte("sale_date", start),
  ]);

  type MonthlySale = { final_price: number; profit: number; quantity: number };
  const totalRevenue = (monthSales ?? []).reduce((s: number, x: MonthlySale) => s + x.final_price, 0);
  const totalProfit = (monthSales ?? []).reduce((s: number, x: MonthlySale) => s + x.profit, 0);
  const totalUnits = (monthSales ?? []).reduce((s: number, x: MonthlySale) => s + x.quantity, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (<div>
      <div className="page-header">
        <h1 className="page-title">Ventas</h1>
        <Link href="/sales/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar venta
        </Link>
      </div>

      {/* Stats del mes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard
          icon={DollarSign}
          label="Ingresos este mes"
          value={formatCurrency(totalRevenue, roaster.currency)}
        />
        <StatsCard
          icon={TrendingUp}
          label="Ganancia este mes"
          value={formatCurrency(totalProfit, roaster.currency)}
          sub={totalRevenue > 0 ? `${avgMargin.toFixed(1)}% margen` : undefined}
        />
        <StatsCard
          icon={Package}
          label="Unidades vendidas"
          value={`${totalUnits}`}
          sub="este mes"
        />
        <StatsCard
          icon={ShoppingBag}
          label="Total ventas"
          value={`${(sales ?? []).length}`}
          sub="histórico"
        />
      </div>

      {/* Tabla */}
      {(sales ?? []).length === 0 ? (<div className="card">
          <EmptyState
            icon={ShoppingBag}
            title="No hay ventas registradas"
            description="Registrá tu primera venta para trackear ingresos y ganancias."
            actionLabel="+ Registrar venta"
            actionHref="/sales/new"
          />
        </div>) : (<div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Fecha</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Producto</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Cliente</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Cant.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Precio unit.</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Descuento</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Ganancia</th>
                </tr>
              </thead>
              <tbody>
                {(sales ?? []).map((s: Sale) => {
                  const coffeeName =
                    s.product_type ==="roasted"
                      ? s.roast_batches?.green_coffees?.name
                      : s.green_coffees?.name;
                  const productLabel =
                    s.product_type ==="roasted"
                      ? `${coffeeName} · ${weightLabels[s.weight_grams!] ?? s.weight_grams +"g"}`
                      : `${coffeeName} · Verde ${formatWeight(s.green_weight_kg ?? 0)}`;

                  return (<tr key={s.id} className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors">
                      <td className="px-5 py-3.5 text-text-secondary">{formatDate(s.sale_date)}</td>
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-text-primary">{productLabel}</span>
                        {s.product_type ==="green" && (<span className="ml-2 text-xs bg-green-50 text-status-success border border-green-200 px-1.5 py-0.5 rounded">
                            Verde
                          </span>)}
                      </td>
                      <td className="px-5 py-3.5 text-text-secondary hidden md:table-cell">
                        {s.client_name ??"—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">{s.quantity}</td>
                      <td className="px-5 py-3.5 text-right font-mono">
                        {formatCurrency(s.unit_price, roaster.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-text-secondary hidden sm:table-cell">
                        {s.discount_pct > 0 ? (<span className="text-status-warning font-mono">-{s.discount_pct}%</span>) :"—"}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary">
                        {formatCurrency(s.final_price, roaster.currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono">
                        <span className={`whitespace-nowrap ${s.profit >= 0 ?"text-status-success" :"text-status-danger"}`}>
                          {formatCurrency(s.profit, roaster.currency)}
                        </span>
                      </td>
                    </tr>);
                })}
              </tbody>
              <tfoot className="border-t-2 border-border-default bg-[#FDFAF6]">
                <tr>
                  <td colSpan={6} className="px-5 py-3 text-xs font-semibold text-text-secondary">
                    Total histórico
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-text-primary">
                    {formatCurrency((sales ?? []).reduce((s: number, x: Sale) => s + x.final_price, 0),
                      roaster.currency)}
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-status-success">
                    {formatCurrency((sales ?? []).reduce((s: number, x: Sale) => s + x.profit, 0),
                      roaster.currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>)}
    </div>);
}
