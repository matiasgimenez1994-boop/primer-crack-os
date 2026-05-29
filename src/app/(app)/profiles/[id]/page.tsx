import { createClient } from"@/lib/supabase/server";
import { notFound, redirect } from"next/navigation";
import Link from"next/link";
import { ArrowLeft, Edit, Flame, Star } from"lucide-react";
import { RoastCurve } from"@/components/ui/RoastCurve";
import { ShareProfileButton } from"./ShareProfileButton";
import { StatusBadge } from"@/components/ui/StatusBadge";
import { ShrinkageIndicator } from"@/components/ui/ShrinkageIndicator";
import { formatDate, formatWeight } from"@/lib/utils";
import type { RoastBatch } from"@/types";

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("id, currency").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { id } = await params;

  const { data: profile } = await supabase
    .from("roast_profiles")
    .select("*, green_coffees(name, origin_country, variety, process)")
    .eq("id", id).eq("roaster_id", roaster.id).single();
  if (!profile) notFound();

  const { data: batches } = await supabase
    .from("roast_batches")
    .select("*")
    .eq("profile_id", id)
    .order("roast_date", { ascending: false });

  const coffee = profile.green_coffees;

  const levelLabels: Record<string, string> = { light:"Claro", medium:"Medio", medium_dark:"Medio Oscuro", dark:"Oscuro" };
  const params_list = [
    { label:"Temperatura de carga", value: profile.charge_temp_celsius ? `${profile.charge_temp_celsius}°C` : null },
    { label:"Tiempo total", value: profile.total_time_min ? `${profile.total_time_min} min` : null },
    { label:"1er crack", value: profile.first_crack_time_min ? `${profile.first_crack_time_min} min` : null },
    { label:"Desarrollo", value: profile.development_time_min ? `${profile.development_time_min} min` : null },
    { label:"% Desarrollo", value: profile.development_pct ? `${profile.development_pct}%` : null },
    { label:"Carga", value: profile.charge_kg ? `${profile.charge_kg} kg` : null },
    { label:"Tostadora", value: profile.roaster_machine },
    { label:"Nivel", value: profile.roast_level ? levelLabels[profile.roast_level] : null },
  ].filter(p => p.value);

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/profiles" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <div className="flex items-center gap-2">
              {profile.is_favorite && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />}
              <h1 className="text-xl font-semibold text-text-primary">{profile.name}</h1>
            </div>
            {coffee && (<p className="text-sm text-text-secondary">
                {coffee.name}{coffee.origin_country ? ` · ${coffee.origin_country}` :""}
              </p>)}
          </div>
        </div>
        <div className="flex gap-2">
          <ShareProfileButton token={profile.share_token} profileId={id} />
          <Link href={`/roasts/new?profile=${profile.id}${coffee ? `&coffee=${profile.green_coffee_id}` :""}`}
            className="btn-primary text-xs">
            <Flame className="w-4 h-4" /> Usar perfil
          </Link>
          <Link href={`/profiles/${id}/edit`} className="btn-secondary text-xs hidden sm:flex">
            <Edit className="w-4 h-4" /> Editar
          </Link>
        </div>
      </div>

      {/* Curva de tueste */}
      {profile.total_time_min && (<div className="mb-6">
          <RoastCurve
            chargeTemp={profile.charge_temp_celsius ?? 200}
            totalTime={profile.total_time_min}
            turningPointTime={profile.turning_point_time_min ?? undefined}
            turningPointTemp={profile.turning_point_temp_celsius ?? undefined}
            yellowingTime={profile.yellowing_time_min ?? undefined}
            yellowingTemp={profile.yellowing_temp_celsius ?? undefined}
            firstCrackTime={profile.first_crack_time_min ?? undefined}
            developmentTime={profile.development_time_min ?? undefined}
            height={160}
            showLabels={true}
          />
        </div>)}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Parámetros */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          {/* Stats clave */}
          <div className="card p-5">
            <p className="section-title">Parámetros clave</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label:"Temp. carga", value: profile.charge_temp_celsius ? `${profile.charge_temp_celsius}°C` :"—", highlight: true },
                { label:"Tiempo total", value: profile.total_time_min ? `${profile.total_time_min}'` :"—", highlight: true },
                { label:"1er crack", value: profile.first_crack_time_min ? `${profile.first_crack_time_min}'` :"—", highlight: false },
                { label:"% Desarrollo", value: profile.development_pct ? `${profile.development_pct}%` :"—", highlight: true },
              ].map(({ label, value, highlight }) => (<div key={label} className={`p-3 rounded-xl text-center ${highlight ?"bg-[#F5EFE6]" :"bg-[#FDFAF6]"}`}>
                  <p className="text-lg font-mono font-bold text-text-primary">{value}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{label}</p>
                </div>))}
            </div>
          </div>

          {/* Detalles completos */}
          <div className="card p-5">
            <p className="section-title">Todos los parámetros</p>
            <dl className="flex flex-col gap-2">
              {params_list.map(({ label, value }) => (<div key={label} className="flex justify-between text-sm">
                  <dt className="text-text-secondary">{label}</dt>
                  <dd className="font-mono font-medium text-text-primary">{value}</dd>
                </div>))}
              {profile.roast_level && (<div className="flex justify-between text-sm items-center">
                  <span className="text-text-secondary">Nivel</span>
                  <StatusBadge status={profile.roast_level} />
                </div>)}
            </dl>
          </div>

          {/* Resultado en taza */}
          {(profile.cup_result || profile.recommendation) && (<div className="card p-5 flex flex-col gap-3">
              {profile.cup_result && (<div>
                  <p className="section-title">Resultado en taza</p>
                  <p className="text-sm text-text-secondary italic">"{profile.cup_result}"</p>
                </div>)}
              {profile.recommendation && (<div className="border-t border-border-default pt-3">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1">
                    Recomendación
                  </p>
                  <p className="text-sm text-text-primary">{profile.recommendation}</p>
                </div>)}
            </div>)}

          <div className="text-xs text-text-secondary px-1">
            Usado {profile.times_used} {profile.times_used === 1 ?"vez" :"veces"} ·
            Creado {formatDate(profile.created_at)}
          </div>
        </div>

        {/* Tuestes usando este perfil */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
              <h2 className="text-sm font-semibold text-text-primary">
                Tuestes con este perfil ({(batches ?? []).length})
              </h2>
              <Link
                href={`/roasts/new?profile=${profile.id}${profile.green_coffee_id ? `&coffee=${profile.green_coffee_id}` :""}`}
                className="btn-primary text-xs py-1.5"
              >
                + Registrar tueste
              </Link>
            </div>

            {(batches ?? []).length === 0 ? (<div className="py-12 text-center">
                <p className="text-sm text-text-secondary">Todavía no hay tuestes con este perfil</p>
                <Link
                  href={`/roasts/new?profile=${profile.id}`}
                  className="btn-primary mt-4 inline-flex text-xs"
                >
                  Registrar primer tueste
                </Link>
              </div>) : (<div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default bg-[#FDFAF6]">
                      <th className="text-left px-5 py-3 text-xs font-medium text-text-secondary">Fecha</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">Lote</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">Merma</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">Costo/kg</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-text-secondary">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batches ?? []).map((b: RoastBatch) => (<tr key={b.id} className="border-b border-border-default last:border-0 hover:bg-[#F5EFE6]/50">
                        <td className="px-5 py-3">
                          <Link href={`/roasts/${b.id}`}
                            className="text-text-secondary hover:text-accent-terra transition-colors">
                            {formatDate(b.roast_date)}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right font-mono">{formatWeight(b.roasted_weight_kg)}</td>
                        <td className="px-5 py-3 text-right">
                          <ShrinkageIndicator pct={b.shrinkage_pct} />
                        </td>
                        <td className="px-5 py-3 text-right font-mono">
                          {b.total_cost_per_kg_roasted ? `$${b.total_cost_per_kg_roasted.toFixed(2)}` :"—"}
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
