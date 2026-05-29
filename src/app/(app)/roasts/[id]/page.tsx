import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { ArrowLeft, BookOpen } from"lucide-react";
import { StatusBadge } from"@/components/ui/StatusBadge";
import { ShrinkageIndicator } from"@/components/ui/ShrinkageIndicator";
import { formatCurrency, formatWeight, formatDate, formatPct } from"@/lib/utils";
import { calculateMargin, ROAST_LEVEL_LABELS } from"@/lib/costs";
import { PricingTable } from"./PricingTable";

export default async function RoastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id, currency")
    .eq("user_id", user.id)
    .single();

  if (!roaster) redirect("/onboarding");

  const { id } = await params;

  const { data: batch } = await supabase
    .from("roast_batches")
    .select("*, green_coffees(*)")
    .eq("id", id)
    .eq("roaster_id", roaster.id)
    .single();

  if (!batch) notFound();

  const { data: prices } = await supabase
    .from("selling_prices")
    .select("*")
    .eq("roast_batch_id", id)
    .order("weight_grams");

  const defaultWeights = [250, 500, 1000];
  const priceMap = Object.fromEntries((prices ?? []).map((p: { weight_grams: number; price: number }) => [p.weight_grams, p.price]));

  const costPerKg = batch.total_cost_per_kg_roasted ?? 0;

  const coffee = batch.green_coffees;

  const detailFields = [
    { label:"Nivel de tueste", value: batch.roast_level ? ROAST_LEVEL_LABELS[batch.roast_level] : null },
    { label:"Tiempo total", value: batch.roast_duration_min ? `${batch.roast_duration_min} min` : null },
    { label:"Temp. de carga", value: batch.charge_temp_celsius ? `${batch.charge_temp_celsius}°C` : null },
    { label:"1er crack", value: batch.first_crack_time_min ? `${batch.first_crack_time_min} min` : null },
    { label:"Desarrollo", value: batch.development_time_min ? `${batch.development_time_min} min` : null },
    { label:"% Desarrollo", value: batch.development_pct ? formatPct(batch.development_pct) : null },
  ].filter((f) => f.value);

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/roasts" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="page-title">{coffee?.name ??"Tueste"}</h1>
            <p className="text-sm text-text-secondary">
              {formatDate(batch.roast_date)} · <StatusBadge status={batch.status} />
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/profiles/new?from_batch=${id}`} className="btn-secondary text-xs hidden sm:flex">
            <BookOpen className="w-3.5 h-3.5" /> Guardar perfil
          </Link>
          <Link href={`/roasts/${id}/edit`} className="btn-secondary text-xs">
            Editar
          </Link>
          <Link href={`/inventory/${coffee?.id}`} className="btn-ghost hidden sm:flex text-xs">
            Ver café
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Resumen del lote */}
        <div className="card p-5">
          <p className="section-title">Resumen del lote</p>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-text-secondary">Verde cargado</p>
              <p className="font-mono font-semibold text-text-primary text-lg">
                {formatWeight(batch.green_weight_kg)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Tostado final</p>
              <p className="font-mono font-semibold text-text-primary text-lg">
                {formatWeight(batch.roasted_weight_kg)}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-secondary">Merma</p>
              <ShrinkageIndicator pct={batch.shrinkage_pct} />
            </div>
            {detailFields.slice(0, 5).map((f) => (<div key={f.label}>
                <p className="text-xs text-text-secondary">{f.label}</p>
                <p className="font-mono font-medium text-text-primary">{f.value}</p>
              </div>))}
          </div>
          {(batch.sensory_result || batch.roaster_notes) && (<div className="mt-4 pt-4 border-t border-border-default flex flex-col gap-2">
              {batch.sensory_result && (<div>
                  <p className="text-xs text-text-secondary mb-0.5">Resultado sensorial</p>
                  <p className="text-sm text-text-primary">{batch.sensory_result}</p>
                </div>)}
              {batch.roaster_notes && (<div>
                  <p className="text-xs text-text-secondary mb-0.5">Notas del tostador</p>
                  <p className="text-sm text-text-primary">{batch.roaster_notes}</p>
                </div>)}
            </div>)}
        </div>

        {/* Costo real por kg */}
        <div className="card p-5">
          <p className="section-title">Costo real por kg tostado</p>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">
                Café verde ({formatWeight(batch.green_weight_kg)})
              </span>
              <span className="font-mono">
                {formatCurrency((coffee?.purchase_price_per_kg ?? 0) * batch.green_weight_kg,
                  roaster.currency)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span className="pl-3">
                Costo efectivo c/merma ({formatPct(batch.shrinkage_pct)})
              </span>
              <span className="font-mono">
                {formatCurrency(costPerKg -
                    batch.packaging_cost_per_kg -
                    batch.energy_cost_per_kg -
                    batch.labor_cost_per_kg,
                  roaster.currency)}
                /kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Empaque</span>
              <span className="font-mono">
                +{formatCurrency(batch.packaging_cost_per_kg, roaster.currency)}/kg
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-secondary">Energía</span>
              <span className="font-mono">
                +{formatCurrency(batch.energy_cost_per_kg, roaster.currency)}/kg
              </span>
            </div>
            {batch.labor_cost_per_kg > 0 && (<div className="flex justify-between">
                <span className="text-text-secondary">Mano de obra</span>
                <span className="font-mono">
                  +{formatCurrency(batch.labor_cost_per_kg, roaster.currency)}/kg
                </span>
              </div>)}
            <div className="border-t border-border-default pt-3 mt-1 flex justify-between">
              <span className="font-semibold text-text-primary">Costo total / kg</span>
              <span className="font-mono font-bold text-accent-terra text-lg">
                {formatCurrency(costPerKg, roaster.currency)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-text-secondary pt-1">
              <span>Costo total del lote ({formatWeight(batch.roasted_weight_kg)})</span>
              <span className="font-mono">
                {formatCurrency(costPerKg * batch.roasted_weight_kg, roaster.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Rentabilidad por presentación */}
      <div className="card p-5">
        <p className="section-title mb-4">Rentabilidad por presentación</p>
        <PricingTable
          batchId={batch.id}
          costPerKg={costPerKg}
          roastedWeightKg={batch.roasted_weight_kg}
          currency={roaster.currency}
          defaultWeights={defaultWeights}
          savedPrices={priceMap}
        />
      </div>
    </div>);
}
