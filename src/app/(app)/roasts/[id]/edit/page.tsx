"use client";

import { useEffect, useState } from"react";
import { useRouter, useParams } from"next/navigation";
import { useForm, useWatch } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import Link from"next/link";
import { ArrowLeft, Trash2 } from"lucide-react";
import { createClient } from"@/lib/supabase/client";
import { toast } from"sonner";
import { calculateCosts, getShrinkageBg } from"@/lib/costs";
import { formatCurrency, formatPct } from"@/lib/utils";
import type { RoastBatch, Roaster } from"@/types";

const schema = z.object({
  roast_date: z.string().min(1),
  green_weight_kg: z.coerce.number().positive(),
  roasted_weight_kg: z.coerce.number().positive(),
  roast_duration_min: z.coerce.number().optional().or(z.literal("")),
  charge_temp_celsius: z.coerce.number().optional().or(z.literal("")),
  first_crack_time_min: z.coerce.number().optional().or(z.literal("")),
  development_time_min: z.coerce.number().optional().or(z.literal("")),
  roast_level: z.enum(["light","medium","medium_dark","dark"]).optional().or(z.literal("")),
  sensory_result: z.string().optional(),
  roaster_notes: z.string().optional(),
  status: z.enum(["trial","production","discarded"]),
  packaging_cost_per_kg: z.coerce.number().min(0),
  energy_cost_per_kg: z.coerce.number().min(0),
  labor_cost_per_kg: z.coerce.number().min(0),
}).refine((d) => d.roasted_weight_kg < d.green_weight_kg,
  { message:"El peso tostado debe ser menor al verde", path: ["roasted_weight_kg"] });

type FormData = z.infer<typeof schema>;

export default function EditRoastPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [batch, setBatch] = useState<RoastBatch | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const watched = useWatch({ control });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("roasters")
        .select("*")
        .eq("user_id", user.id)
        .single()
        .then(({ data: r }) => {
          if (!r) return;
          setRoaster(r);
          supabase
            .from("roast_batches")
            .select("*, green_coffees(*)")
            .eq("id", id)
            .eq("roaster_id", r.id)
            .single()
            .then(({ data: b }) => {
              if (!b) return;
              setBatch(b);
              reset({
                roast_date: b.roast_date,
                green_weight_kg: b.green_weight_kg,
                roasted_weight_kg: b.roasted_weight_kg,
                roast_duration_min: b.roast_duration_min ??"",
                charge_temp_celsius: b.charge_temp_celsius ??"",
                first_crack_time_min: b.first_crack_time_min ??"",
                development_time_min: b.development_time_min ??"",
                roast_level: b.roast_level ??"",
                sensory_result: b.sensory_result ??"",
                roaster_notes: b.roaster_notes ??"",
                status: b.status,
                packaging_cost_per_kg: b.packaging_cost_per_kg,
                energy_cost_per_kg: b.energy_cost_per_kg,
                labor_cost_per_kg: b.labor_cost_per_kg,
              });
              setLoading(false);
            });
        });
    });
  }, [id]);

  const green = Number(watched.green_weight_kg) || 0;
  const roasted = Number(watched.roasted_weight_kg) || 0;
  const price = batch?.green_coffees?.purchase_price_per_kg ?? 0;
  const packaging = Number(watched.packaging_cost_per_kg) || 0;
  const energy = Number(watched.energy_cost_per_kg) || 0;
  const labor = Number(watched.labor_cost_per_kg) || 0;

  const costs =
    green > 0 && roasted > 0 && roasted < green
      ? calculateCosts(green, roasted, price, packaging, energy, labor)
      : null;

  async function onSubmit(data: FormData) {
    if (!roaster || !batch) return;

    const totalCost = costs?.totalCostPerKg ?? batch.total_cost_per_kg_roasted;

    const { error } = await supabase
      .from("roast_batches")
      .update({
        ...data,
        roast_duration_min: data.roast_duration_min || null,
        charge_temp_celsius: data.charge_temp_celsius || null,
        first_crack_time_min: data.first_crack_time_min || null,
        development_time_min: data.development_time_min || null,
        roast_level: data.roast_level || null,
        total_cost_per_kg_roasted: totalCost,
      })
      .eq("id", id);

    if (error) {
      toast.error("Error al guardar los cambios");
      return;
    }

    toast.success("Tueste actualizado");
    router.push(`/roasts/${id}`);
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que querés eliminar este tueste? El stock del café verde no se restaurará automáticamente.")) return;

    const { error } = await supabase
      .from("roast_batches")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Error al eliminar");
      return;
    }

    toast.success("Tueste eliminado");
    router.push("/roasts");
  }

  if (loading) {
    return (<div className="flex items-center justify-center min-h-[300px]">
        <div className="w-6 h-6 border-2 border-border-default border-t-accent-terra rounded-full animate-spin" />
      </div>);
  }

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={`/roasts/${id}`} className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="page-title">Editar tueste</h1>
            <p className="text-sm text-text-secondary">
              {batch?.green_coffees?.name}
            </p>
          </div>
        </div>
        <button
          onClick={handleDelete}
          className="btn-ghost text-status-danger hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Datos del tueste */}
            <div className="card p-6">
              <p className="section-title">Datos del tueste</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-base">Fecha</label>
                  <input type="date" className="input-base" {...register("roast_date")} />
                </div>
                <div>
                  <label className="label-base">Estado</label>
                  <select className="input-base" {...register("status")}>
                    <option value="production">Producción</option>
                    <option value="trial">Prueba</option>
                    <option value="discarded">Descartado</option>
                  </select>
                </div>

                <div>
                  <label className="label-base">Peso verde (kg)</label>
                  <input type="number" step="0.001" className="input-base font-mono" {...register("green_weight_kg")} />
                </div>
                <div>
                  <label className="label-base">Peso tostado (kg)</label>
                  <div>
                    <input type="number" step="0.001" className="input-base font-mono" {...register("roasted_weight_kg")} />
                    {costs && (<div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-xs text-text-secondary">Merma:</span>
                        <span className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded border ${getShrinkageBg(costs.shrinkagePct)}`}>
                          {formatPct(costs.shrinkagePct)}
                        </span>
                      </div>)}
                  </div>
                </div>

                <div>
                  <label className="label-base">Tiempo total (min)</label>
                  <input type="number" step="0.1" className="input-base font-mono" {...register("roast_duration_min")} />
                </div>
                <div>
                  <label className="label-base">Temp. de carga (°C)</label>
                  <input type="number" step="1" className="input-base font-mono" {...register("charge_temp_celsius")} />
                </div>

                <div>
                  <label className="label-base">1er crack (min)</label>
                  <input type="number" step="0.1" className="input-base font-mono" {...register("first_crack_time_min")} />
                </div>
                <div>
                  <label className="label-base">Desarrollo (min)</label>
                  <input type="number" step="0.1" className="input-base font-mono" {...register("development_time_min")} />
                </div>

                <div>
                  <label className="label-base">Nivel de tueste</label>
                  <select className="input-base" {...register("roast_level")}>
                    <option value="">Seleccionar...</option>
                    <option value="light">Claro</option>
                    <option value="medium">Medio</option>
                    <option value="medium_dark">Medio Oscuro</option>
                    <option value="dark">Oscuro</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="label-base">Resultado sensorial</label>
                <input type="text" className="input-base" {...register("sensory_result")} />
              </div>
              <div className="mt-3">
                <label className="label-base">Notas del tostador</label>
                <textarea className="input-base resize-none" rows={2} {...register("roaster_notes")} />
              </div>
            </div>

            {/* Costos */}
            <div className="card p-6">
              <p className="section-title">Costos por kg</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label-base">Empaque</label>
                  <input type="number" step="0.01" className="input-base font-mono" {...register("packaging_cost_per_kg")} />
                </div>
                <div>
                  <label className="label-base">Energía</label>
                  <input type="number" step="0.01" className="input-base font-mono" {...register("energy_cost_per_kg")} />
                </div>
                <div>
                  <label className="label-base">Mano de obra</label>
                  <input type="number" step="0.01" className="input-base font-mono" {...register("labor_cost_per_kg")} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={`/roasts/${id}`} className="btn-secondary flex-1 justify-center">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-primary flex-1 justify-center"
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ?"Guardando..." :"Guardar cambios"}
              </button>
            </div>
          </div>

          {/* Preview costos */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-6">
              <p className="text-sm font-semibold text-text-primary mb-4">
                Costo actualizado
              </p>
              {!costs ? (<p className="text-xs text-text-secondary">
                  Modificá los pesos para ver el nuevo costo.
                </p>) : (<div className="flex flex-col gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Café verde c/merma</span>
                    <span className="font-mono">{formatCurrency(costs.effectiveCostPerKgRoasted, roaster?.currency)}/kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Empaque</span>
                    <span className="font-mono">+{formatCurrency(costs.packagingCostPerKg, roaster?.currency)}/kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Energía</span>
                    <span className="font-mono">+{formatCurrency(costs.energyCostPerKg, roaster?.currency)}/kg</span>
                  </div>
                  <div className="border-t border-border-default pt-2 mt-1 flex justify-between">
                    <span className="font-semibold text-text-primary">Total</span>
                    <span className="font-mono font-bold text-accent-terra">
                      {formatCurrency(costs.totalCostPerKg, roaster?.currency)}/kg
                    </span>
                  </div>
                </div>)}
            </div>
          </div>
        </div>
      </form>
    </div>);
}
