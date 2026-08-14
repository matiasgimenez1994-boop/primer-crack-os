import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { AlertTriangle, Plus, Flame } from"lucide-react";
import { StatusBadge } from"@/components/ui/StatusBadge";
import { ShrinkageIndicator } from"@/components/ui/ShrinkageIndicator";
import { EmptyState } from"@/components/ui/EmptyState";
import { formatCurrency, formatWeight, formatDate } from"@/lib/utils";
import type { RoastBatch } from"@/types";

type RoastPlanItem = {
  id: string;
  coffeeName: string;
  demandedKg: number;
  availableKg: number;
  shortageKg: number;
  estimatedGreenKg: number;
  ordersCount: number;
};

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

  const { data: pendingRoastedItems } = await supabase
    .from("order_items")
    .select("id, roast_batch_id, green_coffee_id, weight_grams, quantity, orders!inner(id, roaster_id, document_type, status, inventory_committed_at), roast_batches(id, current_stock_kg, roasted_weight_kg, green_coffees(name)), green_coffees(id, name)")
    .eq("product_type", "roasted")
    .eq("orders.roaster_id", roaster.id)
    .eq("orders.document_type", "boleta")
    .is("orders.inventory_committed_at", null)
    .in("orders.status", ["pending", "confirmed", "roasting", "ready"]);

  const planningMap = new Map<string, RoastPlanItem>();

  (pendingRoastedItems ?? []).forEach((item: any) => {
    const batch = item.roast_batches;
    const greenCoffee = item.green_coffees;
    const planKey = item.roast_batch_id ? `batch:${item.roast_batch_id}` : item.green_coffee_id ? `green:${item.green_coffee_id}` : item.id;
    const requestedKg = Number(item.weight_grams || 0) * Number(item.quantity || 0) / 1000;
    const availableKg = item.roast_batch_id ? Number(batch?.current_stock_kg ?? batch?.roasted_weight_kg ?? 0) : 0;
    const current = planningMap.get(planKey) ?? {
      id: planKey,
      coffeeName: batch?.green_coffees?.name ?? greenCoffee?.name ?? "Cafe tostado",
      demandedKg: 0,
      availableKg,
      shortageKg: 0,
      estimatedGreenKg: 0,
      ordersCount: 0,
    };

    current.demandedKg += requestedKg;
    current.ordersCount += 1;
    current.shortageKg = Math.max(0, current.demandedKg - current.availableKg);
    current.estimatedGreenKg = current.shortageKg > 0 ? current.shortageKg / 0.85 : 0;
    planningMap.set(planKey, current);
  });

  const roastPlan = Array.from(planningMap.values())
    .filter((item) => item.shortageKg > 0)
    .sort((a, b) => b.shortageKg - a.shortageKg);

  return (<div>
      <div className="page-header">
        <h1 className="page-title">Tuestes</h1>
        <Link href="/roasts/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Registrar tueste
        </Link>
      </div>

      {roastPlan.length > 0 && (
        <div className="card p-5 mb-6 border-orange-200 bg-orange-50">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-900">Planificacion sugerida por ventas sin stock</p>
              <p className="text-xs text-orange-800 mt-1">
                Estas cantidades salen de boletas guardadas que todavia no pudieron comprometer inventario tostado.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-orange-200">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-orange-900">Cafe</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-orange-900">Demandado</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-orange-900">Disponible</th>
                  <th className="text-right py-2 px-4 text-xs font-semibold text-orange-900">Falta tostar</th>
                  <th className="text-right py-2 pl-4 text-xs font-semibold text-orange-900">Verde estimado</th>
                </tr>
              </thead>
              <tbody>
                {roastPlan.map((item) => (
                  <tr key={item.id} className="border-b border-orange-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-orange-950">{item.coffeeName}</td>
                    <td className="py-2 px-4 text-right font-mono text-orange-900">{formatWeight(item.demandedKg)}</td>
                    <td className="py-2 px-4 text-right font-mono text-orange-900">{formatWeight(item.availableKg)}</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-orange-950">{formatWeight(item.shortageKg)}</td>
                    <td className="py-2 pl-4 text-right font-mono text-orange-900">{formatWeight(item.estimatedGreenKg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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

