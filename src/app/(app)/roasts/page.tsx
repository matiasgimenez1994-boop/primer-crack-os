import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { Plus, Flame } from"lucide-react";
import { StatusBadge } from"@/components/ui/StatusBadge";
import { ShrinkageIndicator } from"@/components/ui/ShrinkageIndicator";
import { EmptyState } from"@/components/ui/EmptyState";
import { formatCurrency, formatWeight, formatDate } from"@/lib/utils";
import type { RoastBatch } from"@/types";

export default async function RoastsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();

  if (!roaster) redirect("/onboarding");

  const { data: batches } = await supabase
    .from("roast_batches")
    .select("*, green_coffees(name)")
    .eq("roaster_id", roaster.id)
    .order("roast_date", { ascending: false });

  return (<div>
      <div className="page-header">
        <h1 className="page-title">Tuestes</h1>
        <Link href="/roasts/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar tueste
        </Link>
      </div>

      {(batches ?? []).length === 0 ? (<div className="card">
          <EmptyState
            icon={Flame}
            title="No hay tuestes registrados"
            description="Registrá tu primer tueste para ver costos y rentabilidad automáticamente."
            actionLabel="+ Registrar tueste"
            actionHref="/roasts/new"
          />
        </div>) : (<div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#FDFAF6]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">
                    Café
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">
                    Fecha
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">
                    Verde
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">
                    Tostado
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">
                    Disponible
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">
                    Merma
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">
                    Costo/kg
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary hidden sm:table-cell">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {(batches ?? []).map((b: RoastBatch) => (<tr
                    key={b.id}
                    className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors group"
                  >
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/roasts/${b.id}`}
                        className="font-medium text-text-primary group-hover:text-accent-green transition-colors"
                      >
                        {b.green_coffees?.name ?? "-"}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary hidden sm:table-cell">
                      {formatDate(b.roast_date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-text-secondary">
                      {formatWeight(b.green_weight_kg)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-text-secondary">
                      {formatWeight(b.roasted_weight_kg)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-medium text-text-primary">
                      {formatWeight(b.current_stock_kg ?? b.roasted_weight_kg)}
                    </td>
                    <td className="px-5 py-3.5 text-right hidden md:table-cell">
                      <ShrinkageIndicator pct={b.shrinkage_pct} />
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono text-text-primary">
                      {b.total_cost_per_kg_roasted
                        ? formatCurrency(b.total_cost_per_kg_roasted, roaster.currency)
                        : "-"}
                    </td>
                    <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                      <StatusBadge status={b.status} />
                    </td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>);
}

