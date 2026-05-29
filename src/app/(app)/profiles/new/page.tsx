"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { RoastCurve } from "@/components/ui/RoastCurve";
import type { GreenCoffee, Roaster } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  green_coffee_id: z.string().optional(),
  roaster_machine: z.string().optional(),
  charge_kg: z.coerce.number().positive().optional().or(z.literal("")),
  charge_temp_celsius: z.coerce.number().optional().or(z.literal("")),
  total_time_min: z.coerce.number().optional().or(z.literal("")),
  turning_point_time_min: z.coerce.number().optional().or(z.literal("")),
  turning_point_temp_celsius: z.coerce.number().optional().or(z.literal("")),
  yellowing_time_min: z.coerce.number().optional().or(z.literal("")),
  yellowing_temp_celsius: z.coerce.number().optional().or(z.literal("")),
  first_crack_time_min: z.coerce.number().optional().or(z.literal("")),
  development_time_min: z.coerce.number().optional().or(z.literal("")),
  roast_level: z.enum(["light","medium","medium_dark","dark"]).optional().or(z.literal("")),
  cup_result: z.string().optional(),
  recommendation: z.string().optional(),
  is_favorite: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function NewProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [coffees, setCoffees] = useState<GreenCoffee[]>([]);

  const { register, handleSubmit, control, setValue, watch,
    formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { is_favorite: false },
  });

  const watched = useWatch({ control });
  const devPct = watched.total_time_min && watched.development_time_min
    ? ((Number(watched.development_time_min) / Number(watched.total_time_min)) * 100).toFixed(1)
    : null;

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("*").eq("user_id", user.id).single()
        .then(({ data: r }) => {
          if (!r) return;
          setRoaster(r);
          supabase.from("green_coffees").select("*").eq("roaster_id", r.id)
            .order("name").then(({ data: c }) => {
              setCoffees(c ?? []);
              const preselect = searchParams.get("coffee");
              if (preselect) setValue("green_coffee_id", preselect);
              // Pre-llenar desde un tueste
              const fromBatch = searchParams.get("from_batch");
              if (fromBatch) prefillFromBatch(fromBatch);
            });
        });
    });
  }, []);

  async function prefillFromBatch(batchId: string) {
    const { data: b } = await supabase
      .from("roast_batches").select("*").eq("id", batchId).single();
    if (!b) return;
    setValue("green_coffee_id", b.green_coffee_id);
    setValue("charge_kg", b.green_weight_kg);
    setValue("charge_temp_celsius", b.charge_temp_celsius ?? "");
    setValue("total_time_min", b.roast_duration_min ?? "");
    setValue("first_crack_time_min", b.first_crack_time_min ?? "");
    setValue("development_time_min", b.development_time_min ?? "");
    setValue("roast_level", b.roast_level ?? "");
    setValue("cup_result", b.sensory_result ?? "");
    setValue("name", `Perfil ${new Date(b.roast_date).toLocaleDateString("es-UY")}`);
  }

  async function onSubmit(data: FormData) {
    if (!roaster) return;
    const { error } = await supabase.from("roast_profiles").insert({
      roaster_id: roaster.id,
      ...data,
      green_coffee_id: data.green_coffee_id || null,
      charge_kg: data.charge_kg || null,
      charge_temp_celsius: data.charge_temp_celsius || null,
      total_time_min: data.total_time_min || null,
      turning_point_time_min: data.turning_point_time_min || null,
      turning_point_temp_celsius: data.turning_point_temp_celsius || null,
      yellowing_time_min: data.yellowing_time_min || null,
      yellowing_temp_celsius: data.yellowing_temp_celsius || null,
      first_crack_time_min: data.first_crack_time_min || null,
      development_time_min: data.development_time_min || null,
      roast_level: data.roast_level || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Perfil guardado");
    router.push("/profiles");
  }

  const isFavorite = watch("is_favorite");

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/profiles" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-xl font-semibold text-text-primary">Nuevo perfil de tueste</h1>
        </div>
        <label className={`flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border transition-colors ${isFavorite ? "border-yellow-300 bg-yellow-50" : "border-border-default hover:bg-[#F5EFE6]"}`}>
          <input type="checkbox" className="sr-only" {...register("is_favorite")} />
          <Star className={`w-4 h-4 ${isFavorite ? "text-yellow-500 fill-yellow-500" : "text-text-secondary"}`} />
          <span className="text-sm font-medium text-text-secondary">Favorito</span>
        </label>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Info básica */}
          <div className="flex flex-col gap-5">
            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Identificación</p>
              <div>
                <label className="label-base">Nombre del perfil *</label>
                <input type="text" className="input-base"
                  placeholder="Ej: Etiopía Medio · Verano 2026" {...register("name")} />
                {errors.name && <p className="text-xs text-status-danger mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label-base">Café verde asociado</label>
                <select className="input-base" {...register("green_coffee_id")}>
                  <option value="">Ninguno / genérico</option>
                  {coffees.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Tostadora</label>
                  <input type="text" className="input-base" placeholder="Ej: Probat 5kg" {...register("roaster_machine")} />
                </div>
                <div>
                  <label className="label-base">Carga (kg)</label>
                  <input type="number" step="0.001" className="input-base font-mono" placeholder="5.000" {...register("charge_kg")} />
                </div>
              </div>
              <div>
                <label className="label-base">Nivel de tueste</label>
                <select className="input-base" {...register("roast_level")}>
                  <option value="">Sin especificar</option>
                  <option value="light">Claro</option>
                  <option value="medium">Medio</option>
                  <option value="medium_dark">Medio Oscuro</option>
                  <option value="dark">Oscuro</option>
                </select>
              </div>
            </div>

            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Resultado en taza</p>
              <div>
                <label className="label-base">Notas de cata / resultado</label>
                <textarea className="input-base resize-none" rows={3}
                  placeholder="Durazno, chocolate, acidez brillante..." {...register("cup_result")} />
              </div>
              <div>
                <label className="label-base">Recomendación para repetir</label>
                <textarea className="input-base resize-none" rows={2}
                  placeholder="Bajar 2°C la carga, extender desarrollo 15s..." {...register("recommendation")} />
              </div>
            </div>
          </div>

          {/* Parámetros técnicos */}
          <div className="flex flex-col gap-5">
            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Parámetros de tueste</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Temp. de carga (°C)</label>
                  <input type="number" step="0.5" className="input-base font-mono" placeholder="195" {...register("charge_temp_celsius")} />
                </div>
                <div>
                  <label className="label-base">Tiempo total (min)</label>
                  <input type="number" step="0.1" className="input-base font-mono" placeholder="12.5" {...register("total_time_min")} />
                </div>
              </div>

              {/* Etapas */}
              <div className="border border-border-default rounded-xl p-4 flex flex-col gap-3">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Etapas del tueste</p>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-base">Punto de inflexión (min)</label>
                    <input type="number" step="0.1" className="input-base font-mono" placeholder="1.5" {...register("turning_point_time_min")} />
                  </div>
                  <div>
                    <label className="label-base">Temp. inflexión (°C)</label>
                    <input type="number" step="0.5" className="input-base font-mono" placeholder="150" {...register("turning_point_temp_celsius")} />
                  </div>
                  <div>
                    <label className="label-base">Amarilleo (min)</label>
                    <input type="number" step="0.1" className="input-base font-mono" placeholder="5.0" {...register("yellowing_time_min")} />
                  </div>
                  <div>
                    <label className="label-base">Temp. amarilleo (°C)</label>
                    <input type="number" step="0.5" className="input-base font-mono" placeholder="175" {...register("yellowing_temp_celsius")} />
                  </div>
                  <div>
                    <label className="label-base">1er crack (min)</label>
                    <input type="number" step="0.1" className="input-base font-mono" placeholder="9.2" {...register("first_crack_time_min")} />
                  </div>
                  <div>
                    <label className="label-base">Desarrollo (min)</label>
                    <input type="number" step="0.1" className="input-base font-mono" placeholder="2.1" {...register("development_time_min")} />
                  </div>
                </div>
              </div>
            </div>

            {/* Curva visual en tiempo real */}
            <div className="card p-5">
              <p className="section-title">Curva de tueste (tiempo real)</p>
              <RoastCurve
                chargeTemp={Number(watched.charge_temp_celsius) || 200}
                totalTime={Number(watched.total_time_min) || 0}
                turningPointTime={Number(watched.turning_point_time_min) || undefined}
                turningPointTemp={Number(watched.turning_point_temp_celsius) || undefined}
                yellowingTime={Number(watched.yellowing_time_min) || undefined}
                yellowingTemp={Number(watched.yellowing_temp_celsius) || undefined}
                firstCrackTime={Number(watched.first_crack_time_min) || undefined}
                developmentTime={Number(watched.development_time_min) || undefined}
                height={160}
                showLabels={true}
              />
            </div>

            <div className="flex gap-3">
              <Link href="/profiles" className="btn-secondary flex-1 justify-center">Cancelar</Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar perfil"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function RoastCurvePreview({ totalTime, firstCrackTime, developmentTime, chargeTemp }: {
  totalTime: number; firstCrackTime: number; developmentTime: number; chargeTemp: number;
}) {
  if (!totalTime || !firstCrackTime) {
    return (
      <div className="h-24 flex items-center justify-center">
        <p className="text-xs text-text-secondary">Ingresá tiempo total y 1er crack para ver la curva</p>
      </div>
    );
  }

  const w = 260; const h = 80;
  const pad = 10;

  // Puntos de la curva
  const points = [
    { t: 0, temp: chargeTemp || 180 },
    { t: totalTime * 0.3, temp: (chargeTemp || 180) - 20 }, // dip inicial
    { t: totalTime * 0.6, temp: (chargeTemp || 180) + 20 },
    { t: firstCrackTime, temp: (chargeTemp || 180) + 40 },
    { t: totalTime, temp: (chargeTemp || 180) + 55 },
  ];

  const minTemp = Math.min(...points.map(p => p.temp));
  const maxTemp = Math.max(...points.map(p => p.temp));
  const tempRange = maxTemp - minTemp || 1;

  const toX = (t: number) => pad + ((t / totalTime) * (w - pad * 2));
  const toY = (temp: number) => h - pad - ((temp - minTemp) / tempRange) * (h - pad * 2);

  const pathD = points.map((p, i) =>
    `${i === 0 ? "M" : "L"} ${toX(p.t)} ${toY(p.temp)}`
  ).join(" ");

  const firstCrackX = toX(firstCrackTime);
  const endX = toX(totalTime);
  const devStartX = totalTime > 0 ? toX(totalTime - developmentTime) : endX;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: 80 }}>
      {/* Zona de desarrollo */}
      {developmentTime > 0 && (
        <rect x={devStartX} y={pad} width={endX - devStartX} height={h - pad * 2}
          fill="#C17B4E" opacity="0.12" rx="2" />
      )}
      {/* Línea de 1er crack */}
      <line x1={firstCrackX} y1={pad} x2={firstCrackX} y2={h - pad}
        stroke="#C17B4E" strokeWidth="1.2" strokeDasharray="3,2" opacity="0.6" />
      <text x={firstCrackX + 3} y={pad + 8} fontSize="7" fill="#C17B4E" opacity="0.8">1C</text>
      {/* Curva */}
      <path d={pathD} stroke="#2C1810" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {/* Puntos */}
      {points.map((p, i) => (
        <circle key={i} cx={toX(p.t)} cy={toY(p.temp)} r="2.5"
          fill={i === 0 ? "#6B7C5C" : i === points.length - 1 ? "#B04A3A" : "#2C1810"} />
      ))}
    </svg>
  );
}
