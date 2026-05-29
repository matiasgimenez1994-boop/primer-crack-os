"use client";

import { useEffect, useState } from"react";
import { useRouter, useSearchParams } from"next/navigation";
import { useForm, useWatch } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import Link from"next/link";
import { ArrowLeft, Calculator } from"lucide-react";
import { createClient } from"@/lib/supabase/client";
import { toast } from"sonner";
import { calculateCosts, getShrinkageBg } from"@/lib/costs";
import { formatCurrency, formatPct, todayISO } from"@/lib/utils";
import type { GreenCoffee, Roaster } from"@/types";

const schema = z.object({
  green_coffee_id: z.string().min(1,"Seleccioná un café"),
  roast_date: z.string().min(1),
  green_weight_kg: z.coerce.number().positive("Debe ser mayor a 0"),
  roasted_weight_kg: z.coerce.number().positive("Debe ser mayor a 0"),
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
  {
    message:"El peso tostado debe ser menor al verde",
    path: ["roasted_weight_kg"],
  });

type FormData = z.infer<typeof schema>;

export default function NewRoastPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [coffees, setCoffees] = useState<GreenCoffee[]>([]);
  const [selectedCoffee, setSelectedCoffee] = useState<GreenCoffee | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      roast_date: todayISO(),
      status:"production",
      packaging_cost_per_kg: 0.3,
      energy_cost_per_kg: 0.5,
      labor_cost_per_kg: 0,
    },
  });

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
          setValue("packaging_cost_per_kg", r.default_packaging_cost_per_kg);
          setValue("energy_cost_per_kg", r.default_energy_cost_per_kg);
          setValue("labor_cost_per_kg", r.default_labor_cost_per_kg);

          supabase
            .from("green_coffees")
            .select("*")
            .eq("roaster_id", r.id)
            .neq("status","depleted")
            .order("name")
            .then(({ data: c }) => {
              setCoffees(c ?? []);
              const preselect = searchParams.get("coffee");
              if (preselect && c) {
                const found = c.find((x: GreenCoffee) => x.id === preselect);
                if (found) {
                  setValue("green_coffee_id", found.id);
                  setSelectedCoffee(found);
                }
              }
            });
        });
    });
  }, []);

  function handleCoffeeChange(id: string) {
    const found = coffees.find((c) => c.id === id);
    setSelectedCoffee(found ?? null);
  }

  // Cálculo en tiempo real
  const green = Number(watched.green_weight_kg) || 0;
  const roasted = Number(watched.roasted_weight_kg) || 0;
  const price = selectedCoffee?.purchase_price_per_kg ?? 0;
  const packaging = Number(watched.packaging_cost_per_kg) || 0;
  const energy = Number(watched.energy_cost_per_kg) || 0;
  const labor = Number(watched.labor_cost_per_kg) || 0;

  const costs =
    green > 0 && roasted > 0 && roasted < green
      ? calculateCosts(green, roasted, price, packaging, energy, labor)
      : null;

  async function onSubmit(data: FormData) {
    if (!roaster) return;

    const totalCost = costs?.totalCostPerKg ?? 0;

    const { data: batch, error } = await supabase
      .from("roast_batches")
      .insert({
        roaster_id: roaster.id,
        green_coffee_id: data.green_coffee_id,
        roast_date: data.roast_date,
        green_weight_kg: data.green_weight_kg,
        roasted_weight_kg: data.roasted_weight_kg,
        roast_duration_min: data.roast_duration_min || null,
        charge_temp_celsius: data.charge_temp_celsius || null,
        first_crack_time_min: data.first_crack_time_min || null,
        development_time_min: data.development_time_min || null,
        roast_level: data.roast_level || null,
        sensory_result: data.sensory_result || null,
        roaster_notes: data.roaster_notes || null,
        status: data.status,
        packaging_cost_per_kg: data.packaging_cost_per_kg,
        energy_cost_per_kg: data.energy_cost_per_kg,
        labor_cost_per_kg: data.labor_cost_per_kg,
        total_cost_per_kg_roasted: totalCost,
      })
      .select()
      .single();

    if (error) {
      toast.error("Error al guardar el tueste");
      return;
    }

    // Descontar stock del café verde
    if (selectedCoffee) {
      const newStock = Math.max(0,
        selectedCoffee.current_stock_kg - data.green_weight_kg);
      await supabase
        .from("green_coffees")
        .update({
          current_stock_kg: newStock,
          status: newStock === 0 ?"depleted" : selectedCoffee.status,
        })
        .eq("id", selectedCoffee.id);
    }

    toast.success("Tueste registrado correctamente");
    router.push(`/roasts/${batch.id}`);
  }

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/roasts" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="page-title">Registrar tueste</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna principal */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {/* Paso 1: Café */}
            <div className="card p-6">
              <p className="section-title">1 · Seleccioná el café</p>
              <div>
                <label className="label-base">Café verde *</label>
                <select
                  className="input-base"
                  {...register("green_coffee_id", {
                    onChange: (e) => handleCoffeeChange(e.target.value),
                  })}
                >
                  <option value="">Seleccionar café...</option>
                  {coffees.map((c) => (<option key={c.id} value={c.id}>
                      {c.name} â€” {c.current_stock_kg.toFixed(1)} kg disponibles
                    </option>))}
                </select>
                {errors.green_coffee_id && (<p className="text-xs text-status-danger mt-1">
                    {errors.green_coffee_id.message}
                  </p>)}
              </div>

              {selectedCoffee && (<div className="mt-3 p-3 bg-[#F5EFE6] rounded-lg grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-text-secondary">Precio compra</p>
                    <p className="font-mono font-medium text-text-primary">
                      {formatCurrency(selectedCoffee.purchase_price_per_kg, roaster?.currency)}/kg
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary">Stock disponible</p>
                    <p className="font-mono font-medium text-text-primary">
                      {selectedCoffee.current_stock_kg.toFixed(3)} kg
                    </p>
                  </div>
                  <div>
                    <p className="text-text-secondary">Origen</p>
                    <p className="font-medium text-text-primary">
                      {selectedCoffee.origin_country ??"â€”"}
                    </p>
                  </div>
                </div>)}
            </div>

            {/* Paso 2: Datos del tueste */}
            <div className="card p-6">
              <p className="section-title">2 · Datos del tueste</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-base">Fecha *</label>
                  <input
                    type="date"
                    className="input-base"
                    {...register("roast_date")}
                  />
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
                  <label className="label-base">Peso verde cargado (kg) *</label>
                  <input
                    type="number"
                    step="0.001"
                    className="input-base font-mono"
                    placeholder="5.000"
                    {...register("green_weight_kg")}
                  />
                  {errors.green_weight_kg && (<p className="text-xs text-status-danger mt-1">
                      {errors.green_weight_kg.message}
                    </p>)}
                </div>

                <div>
                  <label className="label-base">Peso tostado final (kg) *</label>
                  <div>
                    <input
                      type="number"
                      step="0.001"
                      className="input-base font-mono"
                      placeholder="4.290"
                      {...register("roasted_weight_kg")}
                    />
                    {errors.roasted_weight_kg && (<p className="text-xs text-status-danger mt-1">
                        {errors.roasted_weight_kg.message}
                      </p>)}
                    {costs && (<div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-xs text-text-secondary">Merma:</span>
                        <span
                          className={`text-xs font-mono font-medium px-1.5 py-0.5 rounded border ${getShrinkageBg(costs.shrinkagePct)}`}
                        >
                          {formatPct(costs.shrinkagePct)}
                        </span>
                      </div>)}
                  </div>
                </div>

                <div>
                  <label className="label-base">Tiempo total (min)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-base font-mono"
                    placeholder="12.5"
                    {...register("roast_duration_min")}
                  />
                </div>
                <div>
                  <label className="label-base">Temp. de carga (°C)</label>
                  <input
                    type="number"
                    step="1"
                    className="input-base font-mono"
                    placeholder="195"
                    {...register("charge_temp_celsius")}
                  />
                </div>

                <div>
                  <label className="label-base">1er crack (min)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-base font-mono"
                    placeholder="9.2"
                    {...register("first_crack_time_min")}
                  />
                </div>
                <div>
                  <label className="label-base">Desarrollo (min)</label>
                  <input
                    type="number"
                    step="0.1"
                    className="input-base font-mono"
                    placeholder="2.1"
                    {...register("development_time_min")}
                  />
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
                <input
                  type="text"
                  className="input-base"
                  placeholder="Durazno, chocolate, acidez brillante..."
                  {...register("sensory_result")}
                />
              </div>

              <div className="mt-3">
                <label className="label-base">Notas del tostador</label>
                <textarea
                  className="input-base resize-none"
                  rows={2}
                  placeholder="Observaciones del proceso..."
                  {...register("roaster_notes")}
                />
              </div>
            </div>

            {/* Paso 3: Costos */}
            <div className="card p-6">
              <p className="section-title">3 · Costos por kg</p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label-base">Empaque</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-base font-mono"
                    {...register("packaging_cost_per_kg")}
                  />
                </div>
                <div>
                  <label className="label-base">Energía</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-base font-mono"
                    {...register("energy_cost_per_kg")}
                  />
                </div>
                <div>
                  <label className="label-base">Mano de obra</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-base font-mono"
                    {...register("labor_cost_per_kg")}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/roasts" className="btn-secondary flex-1 justify-center">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-primary flex-1 justify-center"
                disabled={isSubmitting}
              >
                {isSubmitting ?"Guardando..." :"Guardar y ver costos â†’"}
              </button>
            </div>
          </div>

          {/* Panel lateral: preview de costos */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <Calculator className="w-4 h-4 text-accent-green" />
                <p className="text-sm font-semibold text-text-primary">
                  Preview de costos
                </p>
              </div>

              {!costs || !selectedCoffee ? (<p className="text-xs text-text-secondary">
                  Completá café, peso verde y peso tostado para ver el cálculo en tiempo real.
                </p>) : (<div className="flex flex-col gap-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Café verde</span>
                    <span className="font-mono font-medium">
                      {formatCurrency(costs.effectiveCostPerKgRoasted, roaster?.currency)}/kg
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>· Precio compra</span>
                    <span className="font-mono">
                      {formatCurrency(selectedCoffee.purchase_price_per_kg, roaster?.currency)}/kg verde
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-text-secondary">
                    <span>· Merma ({formatPct(costs.shrinkagePct)})</span>
                    <span className="font-mono">
                      +{formatCurrency(costs.effectiveCostPerKgRoasted - selectedCoffee.purchase_price_per_kg, roaster?.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Empaque</span>
                    <span className="font-mono font-medium">
                      +{formatCurrency(costs.packagingCostPerKg, roaster?.currency)}/kg
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Energía</span>
                    <span className="font-mono font-medium">
                      +{formatCurrency(costs.energyCostPerKg, roaster?.currency)}/kg
                    </span>
                  </div>
                  {costs.laborCostPerKg > 0 && (<div className="flex justify-between text-xs">
                      <span className="text-text-secondary">Mano de obra</span>
                      <span className="font-mono font-medium">
                        +{formatCurrency(costs.laborCostPerKg, roaster?.currency)}/kg
                      </span>
                    </div>)}
                  <div className="border-t border-border-default pt-3 flex justify-between">
                    <span className="text-sm font-semibold text-text-primary">
                      Costo total
                    </span>
                    <span className="text-sm font-mono font-semibold text-accent-green">
                      {formatCurrency(costs.totalCostPerKg, roaster?.currency)}/kg
                    </span>
                  </div>
                  <div className="pt-1 border-t border-border-default text-xs text-text-secondary">
                    <div className="flex justify-between mb-1">
                      <span>Lote ({roasted.toFixed(3)} kg)</span>
                      <span className="font-mono">
                        {formatCurrency(costs.totalCostPerKg * roasted, roaster?.currency)}
                      </span>
                    </div>
                  </div>
                </div>)}
            </div>
          </div>
        </div>
      </form>
    </div>);
}

