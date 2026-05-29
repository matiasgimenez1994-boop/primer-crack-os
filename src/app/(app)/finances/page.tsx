import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import {
  DollarSign, TrendingUp, TrendingDown, Clock,
  AlertTriangle, ShoppingBag, Leaf, Receipt,
} from"lucide-react";
import { StatsCard } from"@/components/ui/StatsCard";
import { formatCurrency, formatDate, currentMonthRange } from"@/lib/utils";
import { subMonths, startOfMonth, endOfMonth, format } from"date-fns";
import { es } from"date-fns/locale";
import { toMonthlyAmount, CATEGORY_LABELS, CATEGORY_ICONS } from"@/lib/expenses";
import type { Sale, Expense } from"@/types";

export default async function FinancesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("*").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { start: monthStart, end: monthEnd } = currentMonthRange();

  const [
    { data: allSales },
    { data: monthSales },
    { data: pendingSales },
    { data: greenCoffees },
    { data: allExpenses },
    { data: monthExpenses },
  ] = await Promise.all([
    supabase.from("sales").select("*").eq("roaster_id", roaster.id),
    supabase.from("sales").select("*").eq("roaster_id", roaster.id)
      .gte("sale_date", monthStart).lte("sale_date", monthEnd),
    supabase.from("sales").select("*, clients(name)")
      .eq("roaster_id", roaster.id).in("payment_status", ["pending","partial"]),
    supabase.from("green_coffees").select("current_stock_kg, purchase_price_per_kg")
      .eq("roaster_id", roaster.id),
    supabase.from("expenses").select("*").eq("roaster_id", roaster.id),
    supabase.from("expenses").select("*").eq("roaster_id", roaster.id)
      .gte("expense_date", monthStart).lte("expense_date", monthEnd),
  ]);

  // â”€â”€ Mes actual â”€â”€
  const monthRevenue = (monthSales ?? []).reduce((s: number, x: Sale) => s + x.final_price, 0);
  const monthGrossProfit = (monthSales ?? []).reduce((s: number, x: Sale) => s + x.profit, 0);
  const monthExpenseTotal = (monthExpenses ?? []).reduce((s: number, e: Expense) => s + e.amount, 0);
  const monthNetProfit = monthGrossProfit - monthExpenseTotal;
  const monthGrossMargin = monthRevenue > 0 ? (monthGrossProfit / monthRevenue) * 100 : 0;
  const monthNetMargin = monthRevenue > 0 ? (monthNetProfit / monthRevenue) * 100 : 0;
  const monthCash = (monthSales ?? []).filter((s: Sale) => s.payment_type ==="cash")
    .reduce((s: number, x: Sale) => s + x.final_price, 0);
  const monthTransfer = (monthSales ?? []).filter((s: Sale) => s.payment_type ==="transfer")
    .reduce((s: number, x: Sale) => s + x.final_price, 0);

  // â”€â”€ Pendiente de cobro â”€â”€
  const totalPending = (pendingSales ?? []).reduce((s: number, x: Sale) => s + (x.final_price - x.amount_paid), 0);

  // â”€â”€ Inventario valorizado â”€â”€
  const inventoryValue = (greenCoffees ?? []).reduce((s: number, c: { current_stock_kg: number; purchase_price_per_kg: number }) =>
      s + c.current_stock_kg * c.purchase_price_per_kg, 0);

  // â”€â”€ Histórico â”€â”€
  const totalRevenue = (allSales ?? []).reduce((s: number, x: Sale) => s + x.final_price, 0);
  const totalGrossProfit = (allSales ?? []).reduce((s: number, x: Sale) => s + x.profit, 0);
  const totalExpenses = (allExpenses ?? []).reduce((s: number, e: Expense) => s + e.amount, 0);
  const totalNetProfit = totalGrossProfit - totalExpenses;

  // â”€â”€ Gastos recurrentes estimados por mes â”€â”€
  const monthlyExpenseEstimate = (allExpenses ?? [])
    .filter((e: Expense) => e.frequency !=="once")
    .reduce((s: number, e: Expense) => s + toMonthlyAmount(e.amount, e.frequency), 0);

  // â”€â”€ íšltimos 6 meses â”€â”€
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const start = format(startOfMonth(d),"yyyy-MM-dd");
    const end = format(endOfMonth(d),"yyyy-MM-dd");
    const ms = (allSales ?? []).filter((s: Sale) => s.sale_date >= start && s.sale_date <= end);
    const me = (allExpenses ?? []).filter((e: Expense) => e.expense_date >= start && e.expense_date <= end);
    const revenue = ms.reduce((s: number, x: Sale) => s + x.final_price, 0);
    const grossProfit = ms.reduce((s: number, x: Sale) => s + x.profit, 0);
    const expenses = me.reduce((s: number, e: Expense) => s + e.amount, 0);
    return {
      month: format(d,"MMM", { locale: es }),
      revenue,
      grossProfit,
      netProfit: grossProfit - expenses,
      expenses,
    };
  });

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  // â”€â”€ Gastos por categoría este mes â”€â”€
  const expenseByCategory: Record<string, number> = {};
  (monthExpenses ?? []).forEach((e: Expense) => {
    expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount;
  });

  return (<div>
      <div className="page-header">
        <h1 className="text-xl font-semibold text-text-primary">Finanzas</h1>
        <div className="flex gap-2">
          <Link href="/expenses/new" className="btn-secondary text-xs">
            <Receipt className="w-4 h-4" /> Registrar gasto
          </Link>
          {(pendingSales ?? []).length > 0 && (<Link href="/finances/pending" className="btn-primary text-xs">
              <Clock className="w-4 h-4" />
              {(pendingSales ?? []).length} pendiente{(pendingSales ?? []).length > 1 ?"s" :""}
            </Link>)}
        </div>
      </div>

      {/* Alerta pagos pendientes */}
      {(pendingSales ?? []).length > 0 && (<div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-warning" />
              <span className="text-sm font-semibold text-status-warning">
                {formatCurrency(totalPending, roaster.currency)} por cobrar
              </span>
            </div>
            <Link href="/finances/pending" className="text-xs text-accent-green hover:underline font-medium">
              Ver y cobrar â†’
            </Link>
          </div>
        </div>)}

      {/* Stats del mes */}
      <p className="section-title">Este mes</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard icon={DollarSign} label="Ingresos" value={formatCurrency(monthRevenue, roaster.currency)} />
        <StatsCard icon={TrendingUp} label="Ganancia bruta"
          value={formatCurrency(monthGrossProfit, roaster.currency)}
          sub={`${monthGrossMargin.toFixed(1)}% margen bruto`} />
        <StatsCard icon={Receipt} label="Gastos"
          value={formatCurrency(monthExpenseTotal, roaster.currency)}
          sub="costos fijos + variables" />
        <StatsCard icon={TrendingDown} label="Ganancia neta"
          value={formatCurrency(monthNetProfit, roaster.currency)}
          sub={`${monthNetMargin.toFixed(1)}% margen neto`}
          alert={monthNetProfit < 0} />
      </div>

      {/* Rentabilidad real */}
      <div className="card p-5 mb-6">
        <p className="text-sm font-semibold text-text-primary mb-1">Rentabilidad real del mes</p>
        <p className="text-xs text-text-secondary mb-4">
          Ingresos - Costo de producción - Gastos operativos
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-sm">
          {[
            { label:"Ingresos", value: monthRevenue, color:"text-text-primary" },
            { label:"- Costo producción", value: monthRevenue - monthGrossProfit, color:"text-status-danger" },
            { label:"- Gastos operativos", value: monthExpenseTotal, color:"text-status-warning" },
            { label:"= Ganancia neta", value: monthNetProfit, color: monthNetProfit >= 0 ?"text-status-success" :"text-status-danger", bold: true },
          ].map(({ label, value, color, bold }) => (<div key={label} className="flex flex-col gap-1">
              <p className="text-xs text-text-secondary">{label}</p>
              <p className={`font-mono text-lg ${bold ?"font-bold" :"font-semibold"} ${color}`}>
                {formatCurrency(value, roaster.currency)}
              </p>
            </div>))}
        </div>
        {monthlyExpenseEstimate > 0 && (<p className="text-xs text-text-secondary mt-4 pt-3 border-t border-border-default">
            ðŸ’¡ Estimado de gastos recurrentes: {formatCurrency(monthlyExpenseEstimate, roaster.currency)}/mes
          </p>)}
      </div>

      {/* Gráfico 6 meses */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-text-primary">íšltimos 6 meses</p>
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-accent-green inline-block" /> Ingresos</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-accent-olive inline-block" /> G. neta</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-300 inline-block" /> Gastos</span>
          </div>
        </div>
        <div className="flex items-end gap-3 h-40">
          {monthlyData.map((m) => (<div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5 h-32">
                <div className="flex-1 bg-accent-green/80 rounded-t-sm"
                  style={{ height: `${Math.max(m.revenue > 0 ? 4 : 0, (m.revenue / maxRevenue) * 100)}%` }} />
                <div className={`flex-1 rounded-t-sm ${m.netProfit >= 0 ?"bg-accent-olive/80" :"bg-red-300"}`}
                  style={{ height: `${Math.max(Math.abs(m.netProfit) > 0 ? 4 : 0, (Math.abs(m.netProfit) / maxRevenue) * 100)}%` }} />
                <div className="flex-1 bg-red-200 rounded-t-sm"
                  style={{ height: `${Math.max(m.expenses > 0 ? 4 : 0, (m.expenses / maxRevenue) * 100)}%` }} />
              </div>
              <p className="text-xs text-text-secondary capitalize">{m.month}</p>
              {m.revenue > 0 && (<p className="text-xs font-mono text-text-primary">{formatCurrency(m.revenue, roaster.currency)}</p>)}
            </div>))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gastos por categoría */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Gastos por categoría (mes)</p>
            <Link href="/expenses" className="text-xs text-accent-green hover:underline">Ver todos â†’</Link>
          </div>
          {Object.keys(expenseByCategory).length === 0 ? (<div className="text-center py-6">
              <p className="text-sm text-text-secondary">Sin gastos este mes</p>
              <Link href="/expenses/new" className="btn-primary mt-3 inline-flex text-xs">+ Registrar gasto</Link>
            </div>) : (<div className="flex flex-col gap-3">
              {Object.entries(expenseByCategory).sort(([,a],[,b]) => b-a).map(([cat, amount]) => {
                const pct = monthExpenseTotal > 0 ? (amount / monthExpenseTotal) * 100 : 0;
                return (<div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">
                        {CATEGORY_ICONS[cat as keyof typeof CATEGORY_ICONS]}{""}
                        {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                      </span>
                      <span className="font-mono font-medium">{formatCurrency(amount, roaster.currency)}</span>
                    </div>
                    <div className="h-1.5 bg-border-default rounded-full">
                      <div className="h-full bg-accent-green rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>);
              })}
            </div>)}
        </div>

        {/* Resumen histórico */}
        <div className="card p-5">
          <p className="section-title">Resumen histórico</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label:"Ingresos totales", value: formatCurrency(totalRevenue, roaster.currency) },
              { label:"Ganancia bruta", value: formatCurrency(totalGrossProfit, roaster.currency) },
              { label:"Gastos totales", value: formatCurrency(totalExpenses, roaster.currency) },
              { label:"Ganancia neta", value: formatCurrency(totalNetProfit, roaster.currency), highlight: true },
              {
                label:"Margen neto promedio",
                value: totalRevenue > 0 ? `${((totalNetProfit / totalRevenue) * 100).toFixed(1)}%` :"â€”",
              },
              { label:"Valor inventario", value: formatCurrency(inventoryValue, roaster.currency) },
              {
                label:"Ticket promedio",
                value: (allSales ?? []).length > 0
                  ? formatCurrency(totalRevenue / (allSales ?? []).length, roaster.currency) :"â€”",
              },
              { label:"Total ventas", value: `${(allSales ?? []).length}` },
            ].map(({ label, value, highlight }) => (<div key={label}>
                <p className="text-xs text-text-secondary">{label}</p>
                <p className={`text-sm font-mono font-semibold mt-0.5 ${highlight
                  ? totalNetProfit >= 0 ?"text-status-success" :"text-status-danger"
                  :"text-text-primary"}`}>
                  {value}
                </p>
              </div>))}
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href:"/finances/pending", icon: Clock, label:"Pagos pendientes", sub: `${(pendingSales ?? []).length} sin cobrar`, alert: (pendingSales ?? []).length > 0 },
          { href:"/expenses", icon: Receipt, label:"Ver gastos", sub: `${(allExpenses ?? []).length} registros` },
          { href:"/sales", icon: ShoppingBag, label:"Ver ventas", sub: `${(allSales ?? []).length} ventas` },
          { href:"/inventory", icon: Leaf, label:"Inventario", sub: formatCurrency(inventoryValue, roaster.currency) },
        ].map(({ href, icon: Icon, label, sub, alert }) => (<Link key={href} href={href}
            className={`card p-4 hover:shadow-card-hover transition-shadow flex items-start gap-3 ${alert ?"border-orange-200 bg-orange-50/50" :""}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${alert ?"bg-orange-100" :"bg-[#F5EFE6]"}`}>
              <Icon className={`w-4 h-4 ${alert ?"text-status-warning" :"text-accent-green"}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{label}</p>
              <p className="text-xs text-text-secondary mt-0.5">{sub}</p>
            </div>
          </Link>))}
      </div>
    </div>);
}

