import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { Plus, Receipt } from"lucide-react";
import { EmptyState } from"@/components/ui/EmptyState";
import { StatsCard } from"@/components/ui/StatsCard";
import { formatCurrency, formatDate, currentMonthRange } from"@/lib/utils";
import {
  CATEGORY_LABELS, CATEGORY_COLORS, CATEGORY_ICONS,
  FREQUENCY_LABELS, toMonthlyAmount,
} from"@/lib/expenses";
import type { Expense } from"@/types";

function expenseCurrency(expense: Expense, fallback: string) {
  return expense.currency ?? fallback;
}

function totalsByCurrency(expenses: Expense[], fallback: string, amount: (expense: Expense) => number = expense => expense.amount) {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    const currency = expenseCurrency(expense, fallback);
    totals[currency] = (totals[currency] ?? 0) + amount(expense);
    return totals;
  }, {});
}

function formatTotals(totals: Record<string, number>) {
  return Object.entries(totals).sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => formatCurrency(amount, currency)).join(" / ") || "UYU 0,00";
}

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("id, currency").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { start, end } = currentMonthRange();

  const [{ data: allExpenses }, { data: monthExpenses }] = await Promise.all([
    supabase.from("expenses").select("*").eq("roaster_id", roaster.id)
      .order("expense_date", { ascending: false }),
    supabase.from("expenses").select("*").eq("roaster_id", roaster.id)
      .gte("expense_date", start).lte("expense_date", end),
  ]);

  const monthTotals = totalsByCurrency(monthExpenses ?? [], roaster.currency);
  const historicTotals = totalsByCurrency(allExpenses ?? [], roaster.currency);

  // Estimado mensual (recurrentes)
  const recurringExpenses = (allExpenses ?? []).filter((e: Expense) => e.frequency !=="once");
  const monthlyEstimates = totalsByCurrency(recurringExpenses, roaster.currency,
    expense => toMonthlyAmount(expense.amount, expense.frequency));

  // Por categoría este mes
  const byCategory: Record<string, Expense[]> = {};
  (monthExpenses ?? []).forEach((e: Expense) => {
    byCategory[e.category] = [...(byCategory[e.category] ?? []), e];
  });
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b.length - a.length)
    .slice(0, 5);

  return (<div>
      <div className="page-header">
        <h1 className="text-xl font-semibold text-text-primary">Gastos</h1>
        <Link href="/expenses/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar gasto
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <StatsCard icon={Receipt} label="Gastos este mes"
          value={formatTotals(monthTotals)}
          sub={`${(monthExpenses ?? []).length} registros`} />
        <StatsCard icon={Receipt} label="Estimado mensual"
          value={formatTotals(monthlyEstimates)}
          sub="gastos recurrentes" />
        <StatsCard icon={Receipt} label="Total histórico"
          value={formatTotals(historicTotals)} />
      </div>

      {/* Por categoría */}
      {topCategories.length > 0 && (<div className="card p-5 mb-6">
          <p className="section-title">Gastos del mes por categoría</p>
          <div className="flex flex-col gap-3">
            {topCategories.map(([cat, expenses]) => {
              const pct = (monthExpenses ?? []).length > 0 ? (expenses.length / (monthExpenses ?? []).length) * 100 : 0;
              return (<div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-text-secondary">
                      {CATEGORY_ICONS[cat as keyof typeof CATEGORY_ICONS]}{""}
                      {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
                    </span>
                    <span className="font-mono font-medium text-text-primary">
                      {formatTotals(totalsByCurrency(expenses, roaster.currency))}
                      <span className="text-xs text-text-secondary ml-1">({expenses.length} registro{expenses.length === 1 ? "" : "s"})</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-border-default rounded-full overflow-hidden">
                    <div className="h-full bg-accent-green rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>);
            })}
          </div>
        </div>)}

      {/* Tabla */}
      {(allExpenses ?? []).length === 0 ? (<div className="card">
          <EmptyState icon={Receipt} title="No hay gastos registrados"
            description="Registrá tus gastos fijos y variables para ver la rentabilidad real del negocio."
            actionLabel="+ Registrar gasto" actionHref="/expenses/new" />
        </div>) : (<div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Gasto</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Frecuencia</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Fecha</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Monto</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Est. mensual</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {(allExpenses ?? []).map((e: Expense) => (<tr key={e.id} className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors group">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text-primary">{e.name}</p>
                      {e.notes && <p className="text-xs text-text-secondary mt-0.5">{e.notes}</p>}
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${CATEGORY_COLORS[e.category]}`}>
                        {CATEGORY_ICONS[e.category]} {CATEGORY_LABELS[e.category]}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary text-xs hidden md:table-cell">
                      {FREQUENCY_LABELS[e.frequency]}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary hidden sm:table-cell">
                      {formatDate(e.expense_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-text-primary">
                      {formatCurrency(e.amount, expenseCurrency(e, roaster.currency))}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-text-secondary hidden md:table-cell">
                      {e.frequency !=="once"
                        ? formatCurrency(toMonthlyAmount(e.amount, e.frequency), expenseCurrency(e, roaster.currency))
                        : "-"}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <Link href={`/expenses/${e.id}/edit`}
                        className="opacity-0 group-hover:opacity-100 btn-ghost text-xs py-1 px-2 transition-opacity">
                        Editar
                      </Link>
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
}

