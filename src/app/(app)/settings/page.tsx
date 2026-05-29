"use client";

import { useEffect, useState } from"react";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { createClient } from"@/lib/supabase/client";
import { toast } from"sonner";
import type { Roaster } from"@/types";

const schema = z.object({
  business_name: z.string().min(2),
  country: z.string().min(1),
  currency: z.string().min(1),
  low_stock_threshold: z.coerce.number().min(0),
  default_energy_cost_per_kg: z.coerce.number().min(0),
  default_packaging_cost_per_kg: z.coerce.number().min(0),
  default_labor_cost_per_kg: z.coerce.number().min(0),
});

type FormData = z.infer<typeof schema>;

export default function SettingsPage() {
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("roasters")
        .select("*")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (!data) return;
          setRoaster(data);
          reset(data);
        });
    });
  }, []);

  async function onSubmit(data: FormData) {
    if (!roaster) return;
    const { error } = await supabase
      .from("roasters")
      .update(data)
      .eq("id", roaster.id);

    if (error) {
      toast.error("Error al guardar");
      return;
    }
    toast.success("Ajustes guardados");
    reset(data);
  }

  return (<div>
      <div className="page-header">
        <h1 className="page-title">Ajustes</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 flex flex-col gap-4">
            <p className="section-title">Tu tostadería</p>

            <div>
              <label className="label-base">Nombre de la tostadería</label>
              <input type="text" className="input-base" {...register("business_name")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">País</label>
                <select className="input-base" {...register("country")}>
                  <option>Uruguay</option>
                  <option>Argentina</option>
                  <option>Chile</option>
                  <option>Colombia</option>
                  <option>Brasil</option>
                  <option>Perú</option>
                  <option>México</option>
                  <option>Otro</option>
                </select>
              </div>
              <div>
                <label className="label-base">Moneda</label>
                <select className="input-base" {...register("currency")}>
                  <option value="USD">USD ($)</option>
                  <option value="UYU">UYU ($U)</option>
                  <option value="ARS">ARS ($)</option>
                  <option value="CLP">CLP ($)</option>
                  <option value="COP">COP ($)</option>
                  <option value="BRL">BRL (R$)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="label-base">Alerta de stock bajo (kg)</label>
              <input
                type="number"
                step="0.5"
                className="input-base font-mono"
                {...register("low_stock_threshold")}
              />
              <p className="text-xs text-text-secondary mt-1">
                Recibís alertas cuando un café tenga menos de este stock
              </p>
            </div>
          </div>

          <div className="card p-6 flex flex-col gap-4">
            <p className="section-title">Costos por defecto por kg</p>
            <p className="text-xs text-text-secondary -mt-2">
              Se usan como valores iniciales en cada nuevo tueste
            </p>

            <div>
              <label className="label-base">Costo de energía / kg tostado</label>
              <input
                type="number"
                step="0.01"
                className="input-base font-mono"
                {...register("default_energy_cost_per_kg")}
              />
            </div>

            <div>
              <label className="label-base">Costo de empaque / kg</label>
              <input
                type="number"
                step="0.01"
                className="input-base font-mono"
                {...register("default_packaging_cost_per_kg")}
              />
            </div>

            <div>
              <label className="label-base">Mano de obra / kg (opcional)</label>
              <input
                type="number"
                step="0.01"
                className="input-base font-mono"
                {...register("default_labor_cost_per_kg")}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="btn-primary"
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting ?"Guardando..." :"Guardar ajustes"}
          </button>
        </div>
      </form>
    </div>);
}
