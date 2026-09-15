"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABELS } from "@/lib/expenses";
import { formatCurrency } from "@/lib/utils";
import type { Expense, ExpenseCategory, ExpenseFrequency } from "@/types";

type Draft = {
  key: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  currency: "USD" | "UYU";
  frequency: ExpenseFrequency;
  expense_date: string | null;
  period_label: string | null;
  date_precision: "exact" | "month" | "year" | null;
  nature: string | null;
  notes: string | null;
  source_ref: string;
  affects_profit: boolean;
  duplicate: string | null;
};

const MONTHS: Record<string, string> = {
  enero: "01", febrero: "02", marzo: "03", abril: "04", mayo: "05", junio: "06",
  julio: "07", agosto: "08", setiembre: "09", septiembre: "09",
  octubre: "10", noviembre: "11", diciembre: "12",
};

function normalized(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function monthFromPeriod(value: unknown) {
  const text = normalized(value);
  const year = text.match(/20\d{2}/)?.[0] ?? "";
  const month = Object.entries(MONTHS).find(([label]) => text.includes(label))?.[1];
  return year && month ? `${year}-${month}` : "";
}

function dateValue(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    // XLSX date serials are decoded with the same library used to read the sheet.
    return null;
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^(20\d{2})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function categoryFor(value: unknown): ExpenseCategory {
  const text = normalized(value);
  if (text.includes("alquiler")) return "rent";
  if (/gas|ute|ose|energia|saneamiento/.test(text)) return "energy";
  if (/bolsa|packaging|empaque|etiqueta|envase/.test(text)) return "packaging";
  if (/publicidad|marketing|fotograf|expo|uber|evento/.test(text)) return "marketing";
  if (/mantenimiento|ferreteria|sodimac|instalacion|mejora/.test(text)) return "maintenance";
  if (/peones|mano de obra|labor/.test(text)) return "labor";
  if (/insumo|cafe|filtro|consumible/.test(text)) return "supplies";
  return "other";
}

function frequencyFor(value: unknown): ExpenseFrequency {
  const text = normalized(value);
  if (text === "monthly" || text === "mensual") return "monthly";
  if (text === "weekly" || text === "semanal") return "weekly";
  if (text === "daily" || text === "diario") return "daily";
  if (text === "yearly" || text === "anual") return "yearly";
  return "once";
}

function duplicateReason(draft: Draft, existing: Expense[], fallback: string) {
  const source = existing.find(e => e.source_ref && e.source_ref === draft.source_ref);
  if (source) return "Esta fila del archivo ya fue importada";
  const name = normalized(draft.name);
  const draftMonth = draft.expense_date?.slice(0, 7) ?? monthFromPeriod(draft.period_label);
  const match = existing.find(e => {
    const existingName = normalized(e.name);
    const comparable = name === existingName || (name.length >= 8 && existingName.length >= 8 &&
      (name.includes(existingName) || existingName.includes(name)));
    const existingCurrency = e.currency ?? fallback;
    const sameCurrency = existingCurrency === draft.currency;
    const sameAmount = Math.abs(Number(e.amount) - draft.amount) < 0.01 ||
      (!sameCurrency && (
        (draft.currency === "USD" && existingCurrency === "UYU" &&
          Math.abs(Number(e.amount) - draft.amount * 40) < 1) ||
        (draft.currency === "UYU" && existingCurrency === "USD" &&
          Math.abs(Number(e.amount) * 40 - draft.amount) < 1)
      ));
    const existingMonth = e.expense_date?.slice(0, 7) ?? monthFromPeriod(e.period_label);
    return comparable && sameAmount &&
      (!draftMonth || !existingMonth || draftMonth === existingMonth);
  });
  return match ? `Coincide con un gasto existente: ${match.name}` : null;
}

export function ExpenseImportClient({ roasterId, fallbackCurrency, existing }: {
  roasterId: string;
  fallbackCurrency: string;
  existing: Expense[];
}) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [filename, setFilename] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function readFile(file: File) {
    setError(""); setDrafts([]); setSelected([]); setFilename(file.name);
    try {
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const master = book.Sheets["Movimientos"];
      const sheet = master ?? book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error("El archivo no tiene hojas");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
      if (!rows.length) throw new Error("La hoja está vacía");
      const isMaster = Boolean(master && "Tipo" in rows[0] && "Concepto" in rows[0]);
      if (!isMaster && !("Descripción" in rows[0] && "Monto" in rows[0])) {
        throw new Error("Usá el libro maestro con la hoja Movimientos o un Excel descargado desde Gastos");
      }

      const candidates = rows.flatMap((row, index): Draft[] => {
        if (isMaster && (normalized(row["Tipo"]) !== "egreso" || normalized(row["Estado"]) !== "confirmado")) return [];
        const name = String(isMaster ? row["Concepto"] : row["Descripción"]).trim();
        const amount = Number(isMaster ? row["Monto original"] : row["Monto"]);
        const currency = String(row["Moneda"]).trim().toUpperCase();
        if (!name || !Number.isFinite(amount) || amount <= 0 || (currency !== "USD" && currency !== "UYU")) return [];
        const period = String(row["Período"] ?? "").trim();
        let exactDate = dateValue(row["Fecha"]);
        if (typeof row["Fecha"] === "number") {
          const decoded = XLSX.SSF.parse_date_code(row["Fecha"] as number);
          if (decoded) exactDate = `${decoded.y}-${String(decoded.m).padStart(2, "0")}-${String(decoded.d).padStart(2, "0")}`;
        }
        const month = monthFromPeriod(period);
        const nature = String(row["Naturaleza"] ?? "").trim() || null;
        const notes = [
          isMaster ? `Período original: ${period || "sin indicar"}` : "",
          isMaster ? `Precisión original: ${row["Precisión"] ?? ""}` : "",
          isMaster ? `Naturaleza: ${nature ?? ""}` : "",
          String(isMaster ? row["Observaciones"] ?? "" : row["Notas"] ?? "").trim(),
        ].filter(Boolean).join(" · ") || null;
        const draft: Draft = {
          key: String(index + 2), name, amount, currency: currency as "USD" | "UYU",
          category: categoryFor(isMaster ? row["Categoría"] : row["Tipo de gasto"]),
          frequency: isMaster ? "once" : frequencyFor(row["Frecuencia"]),
          expense_date: exactDate,
          period_label: month || period || null,
          date_precision: exactDate ? "exact" : month ? "month" : period ? "year" : null,
          nature, notes,
          source_ref: isMaster ? `brachi-finanzas-maestro-2026:movimientos:${index + 2}` :
            `excel:${normalized(file.name)}:${index + 2}`,
          affects_profit: isMaster ? nature === "Gasto operativo" || nature === "Gasto comercial" :
            normalized(row["Afecta rentabilidad"]) !== "no",
          duplicate: null,
        };
        draft.duplicate = duplicateReason(draft, existing, fallbackCurrency);
        return [draft];
      });
      if (!candidates.length) throw new Error("No se encontraron egresos confirmados con monto y moneda válidos");
      setDrafts(candidates);
      setSelected(candidates.filter(d => !d.duplicate).map(d => d.key));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo leer el Excel");
    }
  }

  async function save() {
    const chosen = drafts.filter(d => selected.includes(d.key));
    if (!chosen.length) { toast.error("Seleccioná al menos un gasto"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("La sesión caducó");
      const { data: roaster } = await supabase.from("roasters").select("id")
        .eq("id", roasterId).eq("user_id", user.id).single();
      if (!roaster) throw new Error("No se encontró tu tostadería");
      const batch = chosen.map(({ key, duplicate, ...row }) => ({ ...row, roaster_id: roasterId }));
      const { error: insertError } = await supabase.from("expenses").insert(batch);
      if (insertError) throw new Error(insertError.message);
      toast.success(`${chosen.length} gastos ingresados`);
      router.push("/expenses");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron guardar los gastos");
    } finally { setSaving(false); }
  }

  return <div>
    <div className="page-header">
      <div className="flex items-center gap-3">
        <Link href="/expenses" className="btn-ghost p-2" aria-label="Volver a gastos"><ArrowLeft className="w-4 h-4" /></Link>
        <h1 className="text-xl font-semibold">Ingresar gastos desde Excel</h1>
      </div>
    </div>
    <div className="card p-5 mb-5">
      <label className="label-base" htmlFor="expense-file">Archivo Excel</label>
      <input id="expense-file" type="file" accept=".xlsx,.xls" className="input-base mt-2"
        onChange={event => { const file = event.target.files?.[0]; if (file) void readFile(file); }} />
      <p className="text-sm text-text-secondary mt-2">
        Se leen los egresos CONFIRMADOS de la hoja Movimientos. También podés ingresar un Excel descargado desde Gastos.
        Los movimientos a revisar o excluidos no se cargan.
      </p>
    </div>
    {error && <p role="alert" className="card p-4 mb-5 text-status-danger">{error}</p>}
    {drafts.length > 0 && <>
      <div className="card p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{filename}: {drafts.length} filas válidas</p>
            <p className="text-sm text-text-secondary">{drafts.filter(d => d.duplicate).length} coincidencias detectadas · {drafts.filter(d => d.date_precision === "year").length} sin mes exacto</p>
          </div>
          <button type="button" className="btn-primary" disabled={saving || selected.length === 0} onClick={save}>
            <Upload className="w-4 h-4" /> {saving ? "Ingresando..." : `Ingresar ${selected.length} gastos`}
          </button>
        </div>
        <p className="text-sm text-text-secondary mt-3">
          Las filas que solo indican “2026” quedan sin mes ni día inventado. Los activos, depósitos e inventario se registran
          como salidas de caja y se separan del cálculo de rentabilidad.
        </p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border-default bg-[#FDFAF6]">
            <th className="px-4 py-3 text-left">Ingresar</th><th className="px-4 py-3 text-left">Concepto</th>
            <th className="px-4 py-3 text-left">Tipo</th><th className="px-4 py-3 text-left">Período</th>
            <th className="px-4 py-3 text-right">Monto</th><th className="px-4 py-3 text-left">Revisión</th>
          </tr></thead>
          <tbody>{drafts.map(d => <tr key={d.key} className="border-b border-border-default last:border-0">
            <td className="px-4 py-3"><input type="checkbox" aria-label={`Ingresar ${d.name}`}
              checked={selected.includes(d.key)}
              onChange={e => setSelected(current => e.target.checked ? [...current, d.key] : current.filter(key => key !== d.key))} /></td>
            <td className="px-4 py-3"><p className="font-medium">{d.name}</p><p className="text-xs text-text-secondary">{d.nature}</p></td>
            <td className="px-4 py-3">{CATEGORY_LABELS[d.category]}</td>
            <td className="px-4 py-3">{d.expense_date ?? d.period_label ?? "Sin período"}</td>
            <td className="px-4 py-3 text-right font-mono">{formatCurrency(d.amount, d.currency)}</td>
            <td className="px-4 py-3 text-text-secondary">{d.duplicate ?? (d.affects_profit ? "Gasto operativo/comercial" : "Salida de caja")}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </>}
  </div>;
}
