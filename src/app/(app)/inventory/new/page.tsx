"use client";

import { useRouter } from"next/navigation";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import { ArrowLeft } from"lucide-react";
import Link from"next/link";
import { createClient } from"@/lib/supabase/client";
import { toast } from"sonner";
import { PROCESS_OPTIONS } from"@/lib/costs";
import { todayISO } from"@/lib/utils";
import { useEffect, useState } from"react";
import type { Roaster } from"@/types";

const schema = z.object({
  name: z.string().min(1,"El nombre es requerido"),
  origin_country: z.string().optional(),
  farm_producer: z.string().optional(),
  variety: z.string().optional(),
  process: z.string().optional(),
  score: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  purchase_price_per_kg: z.coerce.number().positive("El precio debe ser mayor a 0"),
  initial_stock_kg: z.coerce.number().min(0,"El stock no puede ser negativo"),
  purchase_date: z.string().optional(),
  supplier: z.string().optional(),
  tasting_notes: z.string().optional(),
  status: z.enum(["active","depleted","reserved"]),
});

type FormData = z.infer<typeof schema>;

export default function NewCoffeePage() {
  const router = useRouter();
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("roasters")
        .select("*")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => setRoaster(data));
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status:"active",
      purchase_date: todayISO(),
    },
  });

  async function onSubmit(data: FormData) {
    if (!roaster) return;

    const { error } = await supabase.from("green_coffees").insert({
      roaster_id: roaster.id,
      ...data,
      score: data.score ==="" ? null : data.score,
      current_stock_kg: data.initial_stock_kg,
    });

    if (error) {
      toast.error("Error al guardar el café");
      return;
    }

    toast.success(`${data.name} agregado al inventario`);
    router.push("/inventory");
  }

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/inventory" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="page-title">Agregar café verde</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información básica */}
          <div className="card p-6 flex flex-col gap-4">
            <p className="section-title">Información del café</p>

            <div>
              <label className="label-base">Nombre comercial *</label>
              <input
                type="text"
                className="input-base"
                placeholder="Ej: Etiopía Yirgacheffe G2"
                {...register("name")}
              />
              {errors.name && (<p className="text-xs text-status-danger mt-1">
                  {errors.name.message}
                </p>)}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">País de origen</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Etiopía"
                  {...register("origin_country")}
                />
              </div>
              <div>
                <label className="label-base">Variedad</label>
                <input
                  type="text"
                  className="input-base"
                  placeholder="Bourbon, Typica..."
                  {...register("variety")}
                />
              </div>
            </div>

            <div>
              <label className="label-base">Finca / Productor</label>
              <input
                type="text"
                className="input-base"
                placeholder="Nombre de la finca"
                {...register("farm_producer")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Proceso</label>
                <select className="input-base" {...register("process")}>
                  <option value="">Seleccionar...</option>
                  {PROCESS_OPTIONS.map((p) => (<option key={p} value={p}>
                      {p}
                    </option>))}
                </select>
              </div>
              <div>
                <label className="label-base">Puntaje Q (opcional)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  className="input-base"
                  placeholder="85.5"
                  {...register("score")}
                />
              </div>
            </div>

            <div>
              <label className="label-base">Notas de cata</label>
              <textarea
                className="input-base resize-none"
                rows={3}
                placeholder="Durazno, jazmín, té negro..."
                {...register("tasting_notes")}
              />
            </div>
          </div>

          {/* Compra y stock */}
          <div className="flex flex-col gap-6">
            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Compra y stock</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">
                    Precio de compra / kg *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="input-base font-mono"
                    placeholder="6.50"
                    {...register("purchase_price_per_kg")}
                  />
                  {errors.purchase_price_per_kg && (<p className="text-xs text-status-danger mt-1">
                      {errors.purchase_price_per_kg.message}
                    </p>)}
                </div>
                <div>
                  <label className="label-base">Stock inicial (kg) *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    className="input-base font-mono"
                    placeholder="20.000"
                    {...register("initial_stock_kg")}
                  />
                  {errors.initial_stock_kg && (<p className="text-xs text-status-danger mt-1">
                      {errors.initial_stock_kg.message}
                    </p>)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Fecha de compra</label>
                  <input
                    type="date"
                    className="input-base"
                    {...register("purchase_date")}
                  />
                </div>
                <div>
                  <label className="label-base">Proveedor</label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="Nombre del proveedor"
                    {...register("supplier")}
                  />
                </div>
              </div>

              <div>
                <label className="label-base">Estado</label>
                <select className="input-base" {...register("status")}>
                  <option value="active">Activo</option>
                  <option value="reserved">Reservado</option>
                  <option value="depleted">Agotado</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/inventory" className="btn-secondary flex-1 justify-center">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-primary flex-1 justify-center"
                disabled={isSubmitting}
              >
                {isSubmitting ?"Guardando..." :"Guardar café"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>);
}
