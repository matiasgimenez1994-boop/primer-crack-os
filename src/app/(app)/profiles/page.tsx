import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import Link from"next/link";
import { Plus, BookOpen, Star } from"lucide-react";
import { EmptyState } from"@/components/ui/EmptyState";
import { StatusBadge } from"@/components/ui/StatusBadge";
import { ROAST_LEVEL_LABELS } from"@/lib/costs";
import type { RoastProfile } from"@/types";

export default async function ProfilesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("id").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { data: profiles } = await supabase
    .from("roast_profiles")
    .select("*, green_coffees(name, origin_country)")
    .eq("roaster_id", roaster.id)
    .order("is_favorite", { ascending: false })
    .order("times_used", { ascending: false });

  const favorites = (profiles ?? []).filter((p: RoastProfile) => p.is_favorite);
  const rest = (profiles ?? []).filter((p: RoastProfile) => !p.is_favorite);

  return (<div>
      <div className="page-header">
        <h1 className="text-xl font-semibold text-text-primary">Perfiles de tueste</h1>
        <Link href="/profiles/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Nuevo perfil
        </Link>
      </div>

      {(profiles ?? []).length === 0 ? (<div className="card">
          <EmptyState icon={BookOpen} title="No hay perfiles guardados"
            description="Guardá los parámetros de tus mejores tuestes para repetirlos exactamente."
            actionLabel="+ Crear primer perfil" actionHref="/profiles/new" />
        </div>) : (<div className="flex flex-col gap-6">
          {/* Favoritos */}
          {favorites.length > 0 && (<div>
              <p className="section-title flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" /> Favoritos
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {favorites.map((p: RoastProfile) => (<ProfileCard key={p.id} profile={p} />))}
              </div>
            </div>)}

          {/* Todos los perfiles */}
          {rest.length > 0 && (<div>
              {favorites.length > 0 && <p className="section-title">Todos los perfiles</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rest.map((p: RoastProfile) => (<ProfileCard key={p.id} profile={p} />))}
              </div>
            </div>)}
        </div>)}
    </div>);
}

function ProfileCard({ profile: p }: { profile: RoastProfile }) {
  const coffee = (p as any).green_coffees;
  return (<Link href={`/profiles/${p.id}`}
      className="card p-5 hover:shadow-card-hover transition-all group flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {p.is_favorite && <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />}
            <h3 className="font-semibold text-text-primary group-hover:text-accent-green transition-colors truncate">
              {p.name}
            </h3>
          </div>
          {coffee && (<p className="text-xs text-text-secondary mt-0.5 truncate">
              {coffee.name}{coffee.origin_country ? ` · ${coffee.origin_country}` :""}
            </p>)}
        </div>
        {p.roast_level && (<StatusBadge status={p.roast_level} className="shrink-0 ml-2" />)}
      </div>

      {/* Parámetros clave */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label:"Carga", value: p.charge_temp_celsius ? `${p.charge_temp_celsius}°C` :""”" },
          { label:"Tiempo", value: p.total_time_min ? `${p.total_time_min}'` :""”" },
          { label:"Desarrollo", value: p.development_pct ? `${p.development_pct}%` :""”" },
        ].map(({ label, value }) => (<div key={label} className="bg-[#FDFAF6] rounded-lg py-2 px-1">
            <p className="text-xs font-mono font-semibold text-text-primary">{value}</p>
            <p className="text-xs text-text-secondary mt-0.5">{label}</p>
          </div>))}
      </div>

      {p.cup_result && (<p className="text-xs text-text-secondary italic truncate">"{p.cup_result}"</p>)}

      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span>{p.times_used} {p.times_used === 1 ?"uso" :"usos"}</span>
        {p.roaster_machine && <span className="truncate ml-2">{p.roaster_machine}</span>}
      </div>
    </Link>);
}

