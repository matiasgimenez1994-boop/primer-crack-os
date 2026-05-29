import { createClient } from"@/lib/supabase/server";
import { notFound } from"next/navigation";
import { RoastCurve } from"@/components/ui/RoastCurve";
import { FirstCrackIcon } from"@/components/ui/FirstCrackIcon";
import type { Metadata } from"next";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("roast_profiles")
    .select("name, green_coffees(name)").eq("share_token", token).single();
  const coffeeName = (data as any)?.green_coffees?.name;
  return {
    title: data ? `${data.name}${coffeeName ? ` · ${coffeeName}` :""} — Primer crack OS` :"Perfil compartido",
    description:"Perfil de tueste compartido desde Primer crack OS",
  };
}

export default async function SharedProfilePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  // Consulta pública — sin auth requerida
  const { data: profile } = await supabase
    .from("roast_profiles")
    .select("*, green_coffees(name, origin_country, variety, process)")
    .eq("share_token", token)
    .single();

  if (!profile) notFound();

  const coffee = profile.green_coffees;

  const LEVEL_LABELS: Record<string, string> = {
    light:"Claro", medium:"Medio", medium_dark:"Medio Oscuro", dark:"Oscuro",
  };

  const params_grid = [
    { label:"Temp. de carga",    value: profile.charge_temp_celsius ? `${profile.charge_temp_celsius}°C` : null },
    { label:"Punto de inflexión",value: profile.turning_point_time_min ? `${profile.turning_point_time_min}' · ${profile.turning_point_temp_celsius ??"?"}°C` : null },
    { label:"Amarilleo",         value: profile.yellowing_time_min ? `${profile.yellowing_time_min}' · ${profile.yellowing_temp_celsius ??"?"}°C` : null },
    { label:"1er crack",         value: profile.first_crack_time_min ? `${profile.first_crack_time_min}'` : null },
    { label:"Desarrollo",        value: profile.development_time_min ? `${profile.development_time_min}' (${profile.development_pct ??"?"}%)` : null },
    { label:"Tiempo total",      value: profile.total_time_min ? `${profile.total_time_min} min` : null },
    { label:"Carga",             value: profile.charge_kg ? `${profile.charge_kg} kg` : null },
    { label:"Nivel",             value: profile.roast_level ? LEVEL_LABELS[profile.roast_level] : null },
    { label:"Tostadora",         value: profile.roaster_machine },
  ].filter(p => p.value);

  return (<div className="min-h-screen bg-bg-base">
      {/* Header */}
      <div className="bg-brand-dark text-white">
        <div className="max-w-2xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent-terra flex items-center justify-center">
              <FirstCrackIcon className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-sm">Primer crack OS</span>
          </div>
          <span className="text-white/50 text-xs">Perfil compartido</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Título */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-text-primary">{profile.name}</h1>
          {coffee && (<div className="flex flex-wrap gap-2 mt-2">
              <span className="text-sm text-text-secondary font-medium">{coffee.name}</span>
              {coffee.origin_country && (<span className="text-xs bg-[#F5EFE6] text-text-secondary px-2 py-0.5 rounded-full">
                  {coffee.origin_country}
                </span>)}
              {coffee.variety && (<span className="text-xs bg-[#F5EFE6] text-text-secondary px-2 py-0.5 rounded-full">
                  {coffee.variety}
                </span>)}
              {coffee.process && (<span className="text-xs bg-[#F5EFE6] text-text-secondary px-2 py-0.5 rounded-full">
                  {coffee.process}
                </span>)}
            </div>)}
          {profile.roast_level && (<span className="inline-block mt-2 text-xs font-medium text-accent-terra bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-md">
              {LEVEL_LABELS[profile.roast_level]}
            </span>)}
        </div>

        {/* Curva */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide mb-3">
            Curva de tueste
          </p>
          <RoastCurve
            chargeTemp={profile.charge_temp_celsius ?? 200}
            totalTime={profile.total_time_min ?? 0}
            turningPointTime={profile.turning_point_time_min ?? undefined}
            turningPointTemp={profile.turning_point_temp_celsius ?? undefined}
            yellowingTime={profile.yellowing_time_min ?? undefined}
            yellowingTemp={profile.yellowing_temp_celsius ?? undefined}
            firstCrackTime={profile.first_crack_time_min ?? undefined}
            developmentTime={profile.development_time_min ?? undefined}
            height={180}
            showLabels={true}
          />
        </div>

        {/* Parámetros */}
        <div className="card p-5 mb-6">
          <p className="section-title">Parámetros</p>
          <div className="grid grid-cols-2 gap-3">
            {params_grid.map(({ label, value }) => (<div key={label} className="flex flex-col gap-0.5">
                <p className="text-xs text-text-secondary">{label}</p>
                <p className="text-sm font-mono font-semibold text-text-primary">{value}</p>
              </div>))}
          </div>
        </div>

        {/* Resultado en taza */}
        {profile.cup_result && (<div className="card p-5 mb-4">
            <p className="section-title">Resultado en taza</p>
            <p className="text-sm text-text-secondary italic">"{profile.cup_result}"</p>
          </div>)}

        {profile.recommendation && (<div className="card p-5 mb-6">
            <p className="section-title">Recomendación</p>
            <p className="text-sm text-text-primary">{profile.recommendation}</p>
          </div>)}

        {/* Footer */}
        <div className="text-center pt-4 border-t border-border-default">
          <p className="text-xs text-text-secondary">
            Perfil creado con{""}
            <span className="font-semibold text-accent-terra">Primer crack OS</span>
            {""}· Software para tostadores de especialidad
          </p>
        </div>
      </div>
    </div>);
}
