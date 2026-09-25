"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { CATEGORY_COLORS, CATEGORY_LABELS, FREQUENCY_LABELS, toMonthlyAmount } from "@/lib/expenses";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Expense } from "@/types";
import { generatePDF } from "@/lib/export";

function totals(expenses: Expense[], fallback: string, monthly = false) {
  const sums = expenses.reduce<Record<string, number>>((result, expense) => {
    const currency = expense.currency ?? fallback;
    result[currency] = (result[currency] ?? 0) +
      (monthly ? toMonthlyAmount(expense.amount, expense.frequency) : expense.amount);
    return result;
  }, {});
  return Object.entries(sums).sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, amount]) => formatCurrency(amount, currency)).join(" / ") || "0";
}
function expenseMonth(expense: Expense) {
  return expense.period_label?.match(/^20\d{2}-\d{2}$/)?.[0] ??
    expense.expense_date?.slice(0, 7) ?? "";
}

export function ExpensesClient({ expenses, fallbackCurrency, businessName, loadError }: {
  expenses: Expense[];
  fallbackCurrency: string;
  businessName: string;
  loadError: boolean;
}) {
  const [month, setMonth] = useState("");
  const [category, setCategory] = useState("");
  const [currency, setCurrency] = useState("");
  const [frequency, setFrequency] = useState("");
  const [search, setSearch] = useState("");
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  const months = useMemo(() => Array.from(new Set(expenses.map(expenseMonth)
    .filter(Boolean) as string[])).sort().reverse(), [expenses]);
  const filtered = useMemo(() => expenses.filter(e =>
    (!month || (month === "no-month" ? !expenseMonth(e) : expenseMonth(e) === month)) &&
    (!category || e.category === category) &&
    (!currency || (e.currency ?? fallbackCurrency) === currency) &&
    (!frequency || e.frequency === frequency) &&
    (!search || `${e.name} ${e.notes ?? ""}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")))
  ), [expenses, month, category, currency, frequency, search, fallbackCurrency]);

  const categories = useMemo(() => Object.entries(
    filtered.reduce<Record<string, Expense[]>>((result, expense) => {
      (result[expense.category] ??= []).push(expense);
      return result;
    }, {})
  ).sort(([, a], [, b]) => b.length - a.length), [filtered]);

  async function downloadPDF() {
    if (downloadingPDF || loadError || !filtered.length) return;
    setDownloadingPDF(true);
    try {
      const doc = await generatePDF({
        title: "Gastos",
        businessName,
        tables: [
          { title: "Filtros aplicados", headers: ["Filtro", "Valor"], rows: [
            ["Mes", month === "no-month" ? "Sin mes definido" : month || "Todos los meses"],
            ["Tipo", CATEGORY_LABELS[category as Expense["category"]] ?? "Todos los tipos"],
            ["Moneda", currency || "Todas las monedas"],
            ["Frecuencia", FREQUENCY_LABELS[frequency as Expense["frequency"]] ?? "Todas"],
            ["Búsqueda", search || "Sin búsqueda"],
          ] },
          { title: "Detalle de gastos", headers: ["Gasto", "Tipo", "Frecuencia", "Fecha / período", "Monto"], rows: filtered.map(e => [
            [e.name, e.notes].filter(Boolean).join("\n"),
            CATEGORY_LABELS[e.category] ?? e.category,
            FREQUENCY_LABELS[e.frequency] ?? e.frequency,
            [e.expense_date ? formatDate(e.expense_date) : "", e.period_label].filter(Boolean).join("\n") || "Sin fecha",
            formatCurrency(e.amount, e.currency ?? fallbackCurrency),
          ]) },
          { title: "Resumen", headers: ["Concepto", "Valor"], rows: [
            ["Registros", filtered.length],
            ["Total por moneda", totals(filtered, fallbackCurrency)],
          ] },
        ],
      });
      doc.save(`gastos-${month || "todos-los-meses"}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`${filtered.length} gastos descargados`);
    } catch {
      toast.error("No se pudo generar el PDF");
    } finally {
      setDownloadingPDF(false);
    }
  }

  async function downloadExcel() {
    if (!filtered.length) { toast.error("No hay gastos para descargar"); return; }
    try {
      const XLSX = await import("xlsx");
      const rows = filtered.map(e => ({
        "Descripción": e.name,
        "Tipo de gasto": CATEGORY_LABELS[e.category] ?? e.category,
        "Frecuencia": FREQUENCY_LABELS[e.frequency] ?? e.frequency,
        "Fecha": e.expense_date ?? "",
        "Período": e.period_label ?? "",
        "Moneda": e.currency ?? fallbackCurrency,
        "Monto": Number(e.amount),
        "Naturaleza": e.nature ?? "",
        "Afecta rentabilidad": e.affects_profit === false ? "No" : "Sí",
        "Notas": e.notes ?? "",
      }));
      const sheet = XLSX.utils.json_to_sheet(rows);
      sheet["!cols"] = [32, 22, 16, 16, 16, 12, 16, 24, 20, 50].map(wch => ({ wch }));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Gastos");
      const suffix = month || "todos-los-meses";
      XLSX.writeFile(book, `gastos-${suffix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${filtered.length} gastos descargados`);
    } catch { toast.error("No se pudo generar el Excel"); }
  }

  return <div>
    <div className="page-header flex-wrap gap-3">
      <h1 className="text-xl font-semibold text-text-primary">Gastos</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/expenses/import" className="btn-secondary"><Upload className="w-4 h-4" /> Ingresar Excel</Link>
        <button type="button" onClick={downloadExcel} className="btn-secondary"><Download className="w-4 h-4" /> Descargar Excel</button>
        <button type="button" onClick={downloadPDF} disabled={downloadingPDF || loadError || !filtered.length} className="btn-secondary"><Download className="w-4 h-4" /> {downloadingPDF ? "Generando..." : "Descargar PDF"}</button>
        <Link href="/expenses/new" className="btn-primary"><Plus className="w-4 h-4" /> Registrar gasto</Link>
      </div>
    </div>

    {loadError && <p role="alert" className="text-status-danger mb-4">No se pudieron cargar los gastos.</p>}
    <div className="card p-4 mb-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="label-base">Mes
          <select className="input-base mt-1" value={month} onChange={e => setMonth(e.target.value)}>
            <option value="">Todos los meses</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
            <option value="no-month">Sin mes definido</option>
          </select>
        </label>
        <label className="label-base">Tipo de gasto
          <select className="input-base mt-1" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Todos los tipos</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="label-base">Moneda
          <select className="input-base mt-1" value={currency} onChange={e => setCurrency(e.target.value)}>
            <option value="">Todas las monedas</option><option value="UYU">UYU</option><option value="USD">USD</option>
          </select>
        </label>
        <label className="label-base">Frecuencia
          <select className="input-base mt-1" value={frequency} onChange={e => setFrequency(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(FREQUENCY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="label-base">Buscar
          <input className="input-base mt-1" type="search" value={search}
            onChange={e => setSearch(e.target.value)} placeholder="Descripción o notas" />
        </label>
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      <div className="card p-4"><p className="text-sm text-text-secondary">Registros filtrados</p><p className="text-xl font-semibold">{filtered.length}</p></div>
      <div className="card p-4"><p className="text-sm text-text-secondary">Total filtrado</p><p className="text-lg font-semibold">{totals(filtered, fallbackCurrency)}</p></div>
      <div className="card p-4"><p className="text-sm text-text-secondary">Estimado mensual recurrente</p><p className="text-lg font-semibold">{totals(filtered.filter(e => e.frequency !== "once"), fallbackCurrency, true)}</p></div>
    </div>

    {categories.length > 0 && <div className="card p-5 mb-5">
      <p className="section-title">Por tipo de gasto</p>
      <div className="flex flex-col gap-2">
        {categories.map(([key, entries]) => <div key={key} className="flex justify-between gap-3 text-sm">
          <span>{CATEGORY_LABELS[key as Expense["category"]] ?? key} · {entries.length}</span>
          <span className="font-mono">{totals(entries, fallbackCurrency)}</span>
        </div>)}
      </div>
    </div>}

    <div className="card overflow-hidden">
      {filtered.length === 0 ? <p className="p-6 text-text-secondary">No hay gastos con estos filtros.</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-border-default bg-[#FDFAF6]">
            <th className="text-left px-5 py-3">Gasto</th><th className="text-left px-5 py-3">Tipo</th>
            <th className="text-left px-5 py-3">Frecuencia</th><th className="text-left px-5 py-3">Fecha</th>
            <th className="text-right px-5 py-3">Monto</th><th className="text-right px-5 py-3">Acción</th>
          </tr></thead>
          <tbody>{filtered.map(e => <tr key={e.id} className="border-b border-border-default last:border-0">
            <td className="px-5 py-3"><p className="font-medium">{e.name}</p>{e.notes && <p className="text-xs text-text-secondary">{e.notes}</p>}</td>
            <td className="px-5 py-3"><span className={`inline-flex px-2 py-0.5 rounded-md text-xs border ${CATEGORY_COLORS[e.category] ?? ""}`}>{CATEGORY_LABELS[e.category] ?? e.category}</span></td>
            <td className="px-5 py-3">{FREQUENCY_LABELS[e.frequency]}</td>
            <td className="px-5 py-3">{e.expense_date ? formatDate(e.expense_date) : e.period_label ?? "Sin fecha"}
              {e.period_label && e.expense_date && <p className="text-xs text-text-secondary">Período: {e.period_label}</p>}</td>
            <td className="px-5 py-3 text-right font-mono font-semibold">{formatCurrency(e.amount, e.currency ?? fallbackCurrency)}</td>
            <td className="px-5 py-3 text-right"><Link className="btn-ghost text-xs" href={`/expenses/${e.id}/edit`}>Editar</Link></td>
          </tr>)}</tbody>
        </table></div>}
    </div>
  </div>;
}
