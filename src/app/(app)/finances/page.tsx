import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import {
  DollarSign, TrendingUp, TrendingDown, Clock,
  AlertTriangle, ShoppingBag, Leaf, Receipt, CalendarRange,
} from"lucide-react";
import { StatsCard } from"@/components/ui/StatsCard";
import { formatCurrency, formatDate } from"@/lib/utils";
import { subMonths, startOfMonth, endOfMonth, format } from"date-fns";
import { es } from"date-fns/locale";
import { toMonthlyAmount, CATEGORY_LABELS, CATEGORY_ICONS } from"@/lib/expenses";
import { convertUsdUyu, getBcuUsdUyuRate } from "@/lib/exchange-rate";
import type { Order, Expense } from"@/types";

type FinanceOrder = Order & {
  order_items?: Array<{
    product_type: "roasted" | "green";
    green_weight_kg: number | null;
    weight_grams: number | null;
    quantity: number;
    green_coffees?: { purchase_price_per_kg?: number | null } | null;
    roast_batches?: { total_cost_per_kg_roasted?: number | null } | null;
  }>;
};

const FINANCE_STATUSES = ["confirmed", "ready", "delivered"];

function orderCost(order: FinanceOrder) {
  return (order.order_items ?? []).reduce((total, item) => {
    if (item.product_type === "green") {
      return total
        + Number(item.green_weight_kg ?? 0)
        * Number(item.green_coffees?.purchase_price_per_kg ?? 0);
    }
    return total
      + (Number(item.weight_grams ?? 0) / 1000)
      * Number(item.quantity ?? 0)
      * Number(item.roast_batches?.total_cost_per_kg_roasted ?? 0);
  }, 0);
}

type DualAmounts = { USD: number; UYU: number };

function dualFromBase(amount: number, baseCurrency: string, usdUyu: number): DualAmounts {
  return {
    USD: convertUsdUyu(amount, baseCurrency, "USD", usdUyu),
    UYU: convertUsdUyu(amount, baseCurrency, "UYU", usdUyu),
  };
}

function revenueDual(orders: FinanceOrder[], baseCurrency: string, usdUyu: number): DualAmounts {
  return orders.reduce<DualAmounts>((total, order) => {
    const sourceCurrency = order.payment_currency ?? baseCurrency;
    total.USD += convertUsdUyu(Number(order.total_amount ?? 0), sourceCurrency, "USD", usdUyu);
    total.UYU += convertUsdUyu(Number(order.total_amount ?? 0), sourceCurrency, "UYU", usdUyu);
    return total;
  }, { USD: 0, UYU: 0 });
}

function profitDual(orders: FinanceOrder[], baseCurrency: string, usdUyu: number): DualAmounts {
  return orders.reduce<DualAmounts>((total, order) => {
    const sourceCurrency = order.payment_currency ?? baseCurrency;
    const cost = orderCost(order);
    total.USD += convertUsdUyu(Number(order.total_amount ?? 0), sourceCurrency, "USD", usdUyu)
      - convertUsdUyu(cost, baseCurrency, "USD", usdUyu);
    total.UYU += convertUsdUyu(Number(order.total_amount ?? 0), sourceCurrency, "UYU", usdUyu)
      - convertUsdUyu(cost, baseCurrency, "UYU", usdUyu);
    return total;
  }, { USD: 0, UYU: 0 });
}

function formatDual(amounts: DualAmounts) {
  return `${formatCurrency(amounts.USD, "USD")} / ${formatCurrency(amounts.UYU, "UYU")}`;
}

function expenseTotalsDual(expenses: Expense[], fallbackCurrency: string, usdUyu: number,
  amount: (expense: Expense) => number = expense => expense.amount): DualAmounts {
  return expenses.reduce<DualAmounts>((totals, expense) => {
    const sourceCurrency = expense.currency ?? fallbackCurrency;
    const value = amount(expense);
    totals.USD += convertUsdUyu(value, sourceCurrency, "USD", usdUyu);
    totals.UYU += convertUsdUyu(value, sourceCurrency, "UYU", usdUyu);
    return totals;
  }, { USD: 0, UYU: 0 });
}

function DualValue({ amounts }: { amounts: DualAmounts }) {
  return (
    <span className="flex flex-col gap-1 text-lg xl:text-xl leading-tight">
      <span className="whitespace-nowrap">{formatCurrency(amounts.USD, "USD")}</span>
      <span className="whitespace-nowrap">{formatCurrency(amounts.UYU, "UYU")}</span>
    </span>
  );
}

type FinanceSearchParams = Record<string, string | string[] | undefined>;

function param(searchParams: FinanceSearchParams, key: string) {
  const value = searchParams[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function FinancesPage({ searchParams = {} }: { searchParams?: FinanceSearchParams }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("*").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const exchangeRate = await getBcuUsdUyuRate();
  const period = param(searchParams, "period") || "month";
  const selectedMonth = param(searchParams, "month") || format(new Date(), "yyyy-MM");
  const selectedFrom = param(searchParams, "from");
  const selectedTo = param(searchParams, "to");
  const periodLabel = period === "all"
    ? "Todo el histórico"
    : period === "custom"
      ? `${selectedFrom || "Inicio"} a ${selectedTo || "Hoy"}`
      : format(new Date(`${selectedMonth}-01T12:00:00`), "MMMM yyyy", { locale: es });
  const inSelectedPeriod = (dateValue: string) => {
    const date = String(dateValue ?? "").slice(0, 10);
    if (period === "all") return true;
    if (period === "custom") {
      if (selectedFrom && date < selectedFrom) return false;
      if (selectedTo && date > selectedTo) return false;
      return true;
    }
    return date.startsWith(selectedMonth);
  };

  const [
    { data: allSales },
    { data: pendingSales },
    { data: greenCoffees },
    { data: allExpenses },
  ] = await Promise.all([
    supabase.from("orders")
      .select("*, order_items(product_type, green_weight_kg, weight_grams, quantity, green_coffees(purchase_price_per_kg), roast_batches(total_cost_per_kg_roasted))")
      .eq("roaster_id", roaster.id).in("status", FINANCE_STATUSES),
    supabase.from("orders").select("*, clients(name)")
      .eq("roaster_id", roaster.id).in("status", FINANCE_STATUSES)
      .in("payment_status", ["pending","partial"]),
    supabase.from("green_coffees").select("current_stock_kg, purchase_price_per_kg")
      .eq("roaster_id", roaster.id),
    supabase.from("expenses").select("*").eq("roaster_id", roaster.id),
  ]);

  const baseCurrency = roaster.currency ?? "USD";
  const financeSales = (allSales ?? []) as FinanceOrder[];
  const currentMonthSales = financeSales.filter(sale => inSelectedPeriod(sale.order_date));
  const monthExpenses = (allExpenses ?? []).filter((expense: Expense) => inSelectedPeriod(expense.expense_date));

  // Período seleccionado: todos los valores se expresan en paralelo en USD y UYU.
  const monthRevenue = revenueDual(currentMonthSales, baseCurrency, exchangeRate.usdUyu);
  const monthGrossProfit = profitDual(currentMonthSales, baseCurrency, exchangeRate.usdUyu);
  const monthExpensesDual = expenseTotalsDual(monthExpenses ?? [], baseCurrency, exchangeRate.usdUyu);
  const monthExpenseTotal = monthExpensesDual.USD;
  const monthNetProfit: DualAmounts = {
    USD: monthGrossProfit.USD - monthExpensesDual.USD,
    UYU: monthGrossProfit.UYU - monthExpensesDual.UYU,
  };
  const monthGrossMargin = monthRevenue.USD > 0 ? (monthGrossProfit.USD / monthRevenue.USD) * 100 : 0;
  const monthNetMargin = monthRevenue.USD > 0 ? (monthNetProfit.USD / monthRevenue.USD) * 100 : 0;

  //  Pendiente de cobro 
  const pendingTotals = ((pendingSales ?? []) as FinanceOrder[]).reduce<DualAmounts>((total, order) => {
    const sourceCurrency = order.payment_currency ?? baseCurrency;
    const remaining = Number(order.total_amount ?? 0) - Number(order.amount_paid ?? 0);
    total.USD += convertUsdUyu(remaining, sourceCurrency, "USD", exchangeRate.usdUyu);
    total.UYU += convertUsdUyu(remaining, sourceCurrency, "UYU", exchangeRate.usdUyu);
    return total;
  }, { USD: 0, UYU: 0 });
  const totalPendingLabel = formatDual(pendingTotals);

  //  Inventario valorizado 
  const inventoryValue = (greenCoffees ?? []).reduce((s: number, c: { current_stock_kg: number; purchase_price_per_kg: number }) =>
      s + c.current_stock_kg * c.purchase_price_per_kg, 0);
  const inventoryValueDual = dualFromBase(inventoryValue, baseCurrency, exchangeRate.usdUyu);

  //  Histórico 
  const totalRevenue = monthRevenue;
  const totalGrossProfit = monthGrossProfit;
  const totalExpenses = monthExpenseTotal;
  const totalExpensesDual = monthExpensesDual;
  const totalNetProfit: DualAmounts = {
    USD: totalGrossProfit.USD - totalExpensesDual.USD,
    UYU: totalGrossProfit.UYU - totalExpensesDual.UYU,
  };

  //  Gastos recurrentes estimados por mes 
  const recurringExpenses = (allExpenses ?? []).filter((e: Expense) => e.frequency !=="once");
  const monthlyExpenseEstimateDual = expenseTotalsDual(recurringExpenses, baseCurrency, exchangeRate.usdUyu,
    expense => toMonthlyAmount(expense.amount, expense.frequency));
  const monthlyExpenseEstimate = monthlyExpenseEstimateDual.USD;
  const monthCostDual: DualAmounts = {
    USD: monthRevenue.USD - monthGrossProfit.USD,
    UYU: monthRevenue.UYU - monthGrossProfit.UYU,
  };
  const ticketAverageDual: DualAmounts = currentMonthSales.length > 0
    ? { USD: totalRevenue.USD / currentMonthSales.length, UYU: totalRevenue.UYU / currentMonthSales.length }
    : { USD: 0, UYU: 0 };

  // Ultimos 6 meses
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const start = format(startOfMonth(d),"yyyy-MM-dd");
    const end = format(endOfMonth(d),"yyyy-MM-dd");
    const ms = financeSales.filter(s => s.order_date >= start && s.order_date <= end);
    const me = (allExpenses ?? []).filter((e: Expense) => e.expense_date >= start && e.expense_date <= end);
    const revenue = revenueDual(ms, baseCurrency, exchangeRate.usdUyu);
    const grossProfit = profitDual(ms, baseCurrency, exchangeRate.usdUyu);
    const expensesDual = expenseTotalsDual(me, baseCurrency, exchangeRate.usdUyu);
    return {
      month: format(d,"MMM", { locale: es }),
      revenue,
      grossProfit,
      netProfit: {
        USD: grossProfit.USD - expensesDual.USD,
        UYU: grossProfit.UYU - expensesDual.UYU,
      },
      expenses: expensesDual,
    };
  });

  const maxRevenue = Math.max(...monthlyData.map(m => m.revenue.USD), 1);

  //  Gastos por categoría este mes 
  const expenseByCategory: Record<string, DualAmounts> = {};
  (monthExpenses ?? []).forEach((e: Expense) => {
    const current = expenseByCategory[e.category] ?? { USD: 0, UYU: 0 };
    const converted = expenseTotalsDual([e], baseCurrency, exchangeRate.usdUyu);
    expenseByCategory[e.category] = { USD: current.USD + converted.USD, UYU: current.UYU + converted.UYU };
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

      <form method="get" className="card p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarRange className="w-4 h-4 text-accent-green" />
          <p className="text-sm font-semibold text-text-primary">Período financiero</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <select name="period" defaultValue={period} className="input-base">
            <option value="month">Por mes</option>
            <option value="custom">Fechas específicas</option>
            <option value="all">Todo el histórico</option>
          </select>
          <input type="month" name="month" defaultValue={selectedMonth} className="input-base" aria-label="Mes" />
          <input type="date" name="from" defaultValue={selectedFrom} className="input-base" aria-label="Fecha desde" />
          <input type="date" name="to" defaultValue={selectedTo} className="input-base" aria-label="Fecha hasta" />
          <button type="submit" className="btn-primary justify-center">Aplicar período</button>
        </div>
        <p className="text-xs text-text-secondary mt-3">Mostrando: <span className="font-medium capitalize">{periodLabel}</span>. Para fechas específicas, elegí esa opción y completá desde/hasta.</p>
      </form>

      {/* Alerta pagos pendientes */}
      {(pendingSales ?? []).length > 0 && (<div className="mb-5 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-warning" />
              <span className="text-sm font-semibold text-status-warning">
                {totalPendingLabel} por cobrar
              </span>
            </div>
            <Link href="/finances/pending" className="text-xs text-accent-green hover:underline font-medium">
              Ver y cobrar 
            </Link>
          </div>
        </div>)}

      {/* Stats del período */}
      <p className="section-title capitalize">{periodLabel}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
        <StatsCard icon={DollarSign} label="Ingresos" value={<DualValue amounts={monthRevenue} />} sub="USD / UYU" />
        <StatsCard icon={TrendingUp} label="Ganancia bruta"
          value={<DualValue amounts={monthGrossProfit} />}
          sub={`${monthGrossMargin.toFixed(1)}% margen bruto`} />
        <StatsCard icon={Receipt} label="Gastos"
          value={<DualValue amounts={monthExpensesDual} />}
          sub="USD / UYU" />
        <StatsCard icon={TrendingDown} label="Ganancia neta"
          value={<DualValue amounts={monthNetProfit} />}
          sub={`${monthNetMargin.toFixed(1)}% margen neto`}
          alert={monthNetProfit.USD < 0} />
      </div>

      {/* Rentabilidad real */}
      <div className="card p-5 mb-6">
        <p className="text-sm font-semibold text-text-primary mb-1">Rentabilidad real del período</p>
        <p className="text-xs text-text-secondary mb-4">
          Cotización BCU: 1 USD = {exchangeRate.usdUyu.toFixed(3)} UYU
          {exchangeRate.date ? ` · cierre ${exchangeRate.date}` : " · valor de respaldo"}
        </p>
        <div className="grid grid-cols-1 gap-4">
          {(["USD", "UYU"] as const).map(currency => (
            <div key={currency} className="rounded-xl border border-border-default p-4">
              <p className="text-xs font-semibold text-text-secondary mb-3">{currency}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
                {[
                  { label:"Ingresos", value: monthRevenue[currency], color:"text-text-primary" },
                  { label:"- Costo producción", value: monthCostDual[currency], color:"text-status-danger" },
                  { label:"- Gastos operativos", value: monthExpensesDual[currency], color:"text-status-warning" },
                  { label:"= Ganancia neta", value: monthNetProfit[currency], color: monthNetProfit[currency] >= 0 ?"text-status-success" :"text-status-danger", bold: true },
                ].map(({ label, value, color, bold }) => (<div key={label} className="flex flex-col gap-1">
                    <p className="text-xs text-text-secondary">{label}</p>
                    <p className={`font-mono text-base ${bold ?"font-bold" :"font-semibold"} ${color}`}>
                      {formatCurrency(value, currency)}
                    </p>
                  </div>))}
              </div>
            </div>
          ))}
        </div>
        {monthlyExpenseEstimate > 0 && (<p className="text-xs text-text-secondary mt-4 pt-3 border-t border-border-default">
            Estimado de gastos recurrentes: {formatDual(monthlyExpenseEstimateDual)}/mes
          </p>)}
      </div>

      {/* Grafico 6 meses */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-5">
          <p className="text-sm font-semibold text-text-primary">Ultimos 6 meses</p>
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
                  style={{ height: `${Math.max(m.revenue.USD > 0 ? 4 : 0, (m.revenue.USD / maxRevenue) * 100)}%` }} />
                <div className={`flex-1 rounded-t-sm ${m.netProfit.USD >= 0 ?"bg-accent-olive/80" :"bg-red-300"}`}
                  style={{ height: `${Math.max(Math.abs(m.netProfit.USD) > 0 ? 4 : 0, (Math.abs(m.netProfit.USD) / maxRevenue) * 100)}%` }} />
                <div className="flex-1 bg-red-200 rounded-t-sm"
                  style={{ height: `${Math.max(m.expenses.USD > 0 ? 4 : 0, (m.expenses.USD / maxRevenue) * 100)}%` }} />
              </div>
              <p className="text-xs text-text-secondary capitalize">{m.month}</p>
              {m.revenue.USD > 0 && (<p className="text-[10px] font-mono text-text-primary text-center">{formatDual(m.revenue)}</p>)}
            </div>))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Gastos por categoría */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">Gastos por categoría (mes)</p>
            <Link href="/expenses" className="text-xs text-accent-green hover:underline">Ver todos </Link>
          </div>
          {Object.keys(expenseByCategory).length === 0 ? (<div className="text-center py-6">
              <p className="text-sm text-text-secondary">Sin gastos este mes</p>
              <Link href="/expenses/new" className="btn-primary mt-3 inline-flex text-xs">+ Registrar gasto</Link>
            </div>) : (<div className="flex flex-col gap-3">
              {Object.entries(expenseByCategory).sort(([,a],[,b]) => b.USD-a.USD).map(([cat, amount]) => {
                const pct = monthExpenseTotal > 0 ? (amount.USD / monthExpenseTotal) * 100 : 0;
                return (<div key={cat}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-text-secondary">
                        {CATEGORY_ICONS[cat as keyof typeof CATEGORY_ICONS]}{""}
                        {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                      </span>
                      <span className="font-mono text-xs font-medium">
                        {formatDual(amount)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-border-default rounded-full">
                      <div className="h-full bg-accent-green rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>);
              })}
            </div>)}
        </div>

        {/* Resumen del período */}
        <div className="card p-5">
          <p className="section-title">Resumen del período</p>
          <div className="grid grid-cols-2 gap-4">
            {[
              { label:"Ingresos totales", value: formatDual(totalRevenue) },
              { label:"Ganancia bruta", value: formatDual(totalGrossProfit) },
              { label:"Gastos totales", value: formatDual(totalExpensesDual) },
              { label:"Ganancia neta", value: formatDual(totalNetProfit), highlight: true },
              {
                label:"Margen neto promedio",
                value: totalRevenue.USD > 0 ? `${((totalNetProfit.USD / totalRevenue.USD) * 100).toFixed(1)}%` : "-",
              },
              { label:"Valor inventario", value: formatDual(inventoryValueDual) },
              {
                label:"Ticket promedio",
                value: currentMonthSales.length > 0 ? formatDual(ticketAverageDual) : "-",
              },
              { label:"Total ventas", value: `${currentMonthSales.length}` },
            ].map(({ label, value, highlight }) => (<div key={label}>
                <p className="text-xs text-text-secondary">{label}</p>
                <p className={`text-sm font-mono font-semibold mt-0.5 ${highlight
                  ? totalNetProfit.USD >= 0 ?"text-status-success" :"text-status-danger"
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
          { href:"/sales", icon: ShoppingBag, label:"Ver ventas", sub: `${financeSales.length} ventas` },
          { href:"/inventory", icon: Leaf, label:"Inventario", sub: formatDual(inventoryValueDual) },
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
