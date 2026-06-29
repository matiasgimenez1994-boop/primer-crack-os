import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { ArrowLeft, Edit, Flame } from"lucide-react";
import { StatusBadge } from"@/components/ui/StatusBadge";
import { ShrinkageIndicator } from"@/components/ui/ShrinkageIndicator";
import { formatCurrency, formatWeight, formatDate } from"@/lib/utils";
import type { RoastBatch } from"@/types";

export default async function CoffeeDetailPage({
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

  const { id } = await params;

  const { data: coffee } = await supabase
    .from("green_coffees")
    .select("*")
    .eq("id", id)
    .eq("roaster_id", roaster?.id)
    .single();

  if (!coffee) notFound();

  const { data: batches } = await supabase
    .from("roast_batches")
    .select("*")
    .eq("green_coffee_id", id)
    .order("roast_date", { ascending: false });

  const totalRoasted = (batches ?? []).reduce((sum: number, b: RoastBatch) => sum + b.roasted_weight_kg, 0);
  const totalRoastedAvailable = (batches ?? []).reduce((sum: number, b: RoastBatch) => sum + Number(b.current_stock_kg ?? b.roasted_weight_kg ?? 0), 0);

  const fields = [
    { label:"País de origen", value: coffee.origin_country },
    { label:"Finca / Productor", value: coffee.farm_producer },
    { label:"Variedad", value: coffee.variety },
    { label:"Proceso", value: coffee.process },
    { label:"Puntaje Q", value: coffee.score ? `${coffee.score}` : null },
    { label:"Proveedor", value: coffee.supplier },
    { label:"Fecha de compra", value: coffee.purchase_date ? formatDate(coffee.purchase_date) : null },
  ].filter((f) => f.value);

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="page-title">{coffee.name}</h1>
            {coffee.origin_country && (<p className="text-sm text-text-secondary">{coffee.origin_country}</p>)}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/roasts/new?coffee=${coffee.id}`} className="btn-secondary">
            <Flame className="w-4 h-4" /> Registrar tueste
          </Link>
          <Link href={`/inventory/${coffee.id}/edit`} className="btn-ghost">
            <Edit className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info + stock */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="card p-5">
            <p className="section-title">Stock actual</p>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-semibold font-mono text-text-primary">
                {formatWeight(coffee.current_stock_kg)}
              </span>
              <StatusBadge status={coffee.status} />
            </div>
            <div className="mt-3 pt-3 border-t border-border-default grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-text-secondary">Stock inicial</p>
                <p className="font-mono font-medium">
                  {formatWeight(coffee.initial_stock_kg)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Usado en tuestes</p>
                <p className="font-mono font-medium">
                  {formatWeight(coffee.initial_stock_kg - coffee.current_stock_kg)}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Precio compra</p>
                <p className="font-mono font-medium">
                  {formatCurrency(coffee.purchase_price_per_kg, roaster?.currency)}
                  /kg
                </p>
              </div>
              <div>
                <p className="text-xs text-text-secondary">Valor actual</p>
                <p className="font-mono font-medium">
                  {formatCurrency(coffee.current_stock_kg * coffee.purchase_price_per_kg,
                    roaster?.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="section-title">Detalles</p>
            <dl className="flex flex-col gap-2.5">
              {fields.map((f) => (<div key={f.label} className="flex justify-between text-sm">
                  <dt className="text-text-secondary">{f.label}</dt>
                  <dd className="font-medium text-text-primary text-right">
                    {f.value}
                  </dd>
                </div>))}
            </dl>
          </div>

          {coffee.tasting_notes && (<div className="card p-5">
              <p className="section-title">Notas de cata</p>
              <p className="text-sm text-text-secondary leading-relaxed">
                {coffee.tasting_notes}
              </p>
            </div>)}
        </div>

        {/* Historial de tuestes */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
              <h2 className="text-sm font-semibold text-text-primary">
                Historial de tuestes
              </h2>
              {(batches ?? []).length > 0 && (<span className="text-xs text-text-secondary font-mono">
                  {formatWeight(totalRoastedAvailable)} disponibles / {formatWeight(totalRoasted)} tostados
                </span>)}
            </div>

            {(batches ?? []).length === 0 ? (<div className="py-12 text-center">
                <p className="text-sm text-text-secondary">
                  Todavía no hay tuestes con este café
                </p>
                <Link
                  href={`/roasts/new?coffee=${coffee.id}`}
                  className="btn-primary mt-4 inline-flex"
                >
                  Registrar primer tueste
                </Link>
              </div>) : (<div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-[#FDFAF6]">
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary">
                        Fecha
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                        Lote
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                        Disponible
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                        Merma
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                        Costo/kg
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batches ?? []).map((b: RoastBatch) => (<tr
                        key={b.id}
                        className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-text-secondary">
                          <Link
                            href={`/roasts/${b.id}`}
                            className="hover:text-accent-terra transition-colors"
                          >
                            {formatDate(b.roast_date)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-text-secondary">
                          {formatWeight(b.roasted_weight_kg)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-medium text-text-primary">
                          {formatWeight(b.current_stock_kg ?? b.roasted_weight_kg)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <ShrinkageIndicator pct={b.shrinkage_pct} />
                        </td>
                        <td className="px-5 py-3 text-right font-mono">
                          {b.total_cost_per_kg_roasted
                            ? formatCurrency(b.total_cost_per_kg_roasted, roaster?.currency)
                            :"—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <StatusBadge status={b.status} />
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>)}
          </div>
        </div>
      </div>
    </div>);
}
