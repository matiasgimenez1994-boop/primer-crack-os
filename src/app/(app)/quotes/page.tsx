import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSignature, Plus, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatsCard } from "@/components/ui/StatsCard";
import { formatCurrency, formatDate } from "@/lib/utils";
import { QUOTE_CATEGORY_LABELS, QUOTE_STATUS_LABELS } from "@/lib/quotes";
import type { Quotation } from "@/types";

export default async function QuotesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();
  if (!roaster) redirect("/onboarding");

  const { data: quotes } = await supabase
    .from("quotations")
    .select("*")
    .eq("roaster_id", roaster.id)
    .order("quote_date", { ascending: false })
    .order("created_at", { ascending: false });

  const list = (quotes ?? []) as Quotation[];
  const issued = list.filter((q) => q.status === "issued").length;
  const accepted = list.filter((q) => q.status === "accepted").length;
  const totalOpen = list
    .filter((q) => ["draft", "issued", "accepted"].includes(q.status))
    .reduce((sum, q) => sum + q.total_amount, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cotizaciones</h1>
          <p className="text-sm text-text-secondary">
            Presupuestos comerciales con importes históricos e IVA por cotización.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/quotes/prices" className="btn-secondary">
            <Settings className="w-4 h-4" /> Precios
          </Link>
          <Link href="/quotes/new" className="btn-primary">
            <Plus className="w-4 h-4" /> Nueva cotización
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatsCard icon={FileSignature} label="Cotizaciones" value={`${list.length}`} sub="histórico" />
        <StatsCard icon={FileSignature} label="Emitidas" value={`${issued}`} />
        <StatsCard icon={FileSignature} label="Aceptadas" value={`${accepted}`} />
        <StatsCard icon={FileSignature} label="Abiertas" value={formatCurrency(totalOpen, roaster.currency)} />
      </div>

      {list.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={FileSignature}
            title="No hay cotizaciones"
            description="Creá cotizaciones de café verde, Crea tu Marca o máquinas tostadoras."
            actionLabel="+ Nueva cotización"
            actionHref="/quotes/new"
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Número</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">Fecha</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Total</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Estado</th>
                </tr>
              </thead>
              <tbody>
                {list.map((quote) => (
                  <tr key={quote.id} className="border-b border-border-default last:border-0 hover:bg-[#F8FAFC] transition-colors">
                    <td className="px-5 py-3.5">
                      <Link href={`/quotes/${quote.id}`} className="font-medium text-text-primary hover:text-accent-green">
                        {quote.quote_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {quote.client_name ?? "Sin cliente"}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary hidden md:table-cell">
                      {QUOTE_CATEGORY_LABELS[quote.category]}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary hidden sm:table-cell">
                      {formatDate(quote.quote_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium">
                      {formatCurrency(quote.total_amount, quote.currency ?? roaster.currency)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                        {QUOTE_STATUS_LABELS[quote.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
