"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { PROCESS_OPTIONS } from "@/lib/costs";
import type { GreenCoffee, Roaster } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  origin_country: z.string().optional(),
  farm_producer: z.string().optional(),
  variety: z.string().optional(),
  process: z.string().optional(),
  score: z.coerce.number().min(0).max(100).optional().or(z.literal("")),
  purchase_price_per_kg: z.coerce.number().positive("El precio debe ser mayor a 0"),
  current_stock_kg: z.coerce.number().min(0, "El stock no puede ser negativo"),
  purchase_date: z.string().optional(),
  supplier: z.string().optional(),
  tasting_notes: z.string().optional(),
  status: z.enum(["active", "depleted", "reserved"]),
});

type FormData = z.infer<typeof schema>;

export default function EditCoffeePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [coffee, setCoffee] = useState<GreenCoffee | null>(null);
  const [loading, setLoading] = useState(true);

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
        .then(({ data: r }) => {
          if (!r) return;
          setRoaster(r);
          supabase
            .from("green_coffees")
            .select("*")
            .eq("id", id)
            .eq("roaster_id", r.id)
            .single()
            .then(({ data: c }) => {
              if (!c) return;
              setCoffee(c);
              reset({
                ...c,
                score: c.score ?? "",
                purchase_date: c.purchase_date ?? "",
              });
              setLoading(false);
            });
        });
    });
  }, [id]);

  async function onSubmit(data: FormData) {
    if (!roaster || !coffee) return;

    const { error } = await supabase
      .from("green_coffees")
      .update({
        ...data,
        score: data.score === "" ? null : data.score,
      })
      .eq("id", id);

    if (error) {
      toast.error("Error al guardar los cambios");
      return;
    }

    toast.success("Café actualizado");
    router.push(`/inventory/${id}`);
  }

  async function handleDelete() {
    if (!confirm("¿Seguro que querés eliminar este café? Esta acción no se puede deshacer.")) return;

    const { error } = await supabase
      .from("green_coffees")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("No se puede eliminar — tiene tuestes asociados");
      return;
    }

    toast.success("Café eliminado");
    router.push("/inventory");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="w-6 h-6 border-2 border-border-default border-t-accent-terra rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={`/inventory/${id}`} className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="page-title">Editar café verde</h1>
        </div>
        <button
          onClick={handleDelete}
          className="btn-ghost text-status-danger hover:bg-red-50"
        >
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Información básica */}
          <div className="card p-6 flex flex-col gap-4">
            <p className="section-title">Información del café</p>

            <div>
              <label className="label-base">Nombre comercial *</label>
              <input type="text" className="input-base" {...register("name")} />
              {errors.name && (
                <p className="text-xs text-status-danger mt-1">{errors.name.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">País de origen</label>
                <input type="text" className="input-base" {...register("origin_country")} />
              </div>
              <div>
                <label className="label-base">Variedad</label>
                <input type="text" className="input-base" {...register("variety")} />
              </div>
            </div>

            <div>
              <label className="label-base">Finca / Productor</label>
              <input type="text" className="input-base" {...register("farm_producer")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Proceso</label>
                <select className="input-base" {...register("process")}>
                  <option value="">Seleccionar...</option>
                  {PROCESS_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-base">Puntaje Q</label>
                <input type="number" step="0.1" min="0" max="100" className="input-base" {...register("score")} />
              </div>
            </div>

            <div>
              <label className="label-base">Notas de cata</label>
              <textarea className="input-base resize-none" rows={3} {...register("tasting_notes")} />
            </div>
          </div>

          {/* Compra y stock */}
          <div className="flex flex-col gap-6">
            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Compra y stock</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Precio de compra / kg *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-base font-mono"
                    {...register("purchase_price_per_kg")}
                  />
                  {errors.purchase_price_per_kg && (
                    <p className="text-xs text-status-danger mt-1">
                      {errors.purchase_price_per_kg.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label-base">Stock actual (kg)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="input-base font-mono"
                    {...register("current_stock_kg")}
                  />
                  <p className="text-xs text-text-secondary mt-1">
                    Podés corregir el stock manualmente acá
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Fecha de compra</label>
                  <input type="date" className="input-base" {...register("purchase_date")} />
                </div>
                <div>
                  <label className="label-base">Proveedor</label>
                  <input type="text" className="input-base" {...register("supplier")} />
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
              <Link href={`/inventory/${id}`} className="btn-secondary flex-1 justify-center">
                Cancelar
              </Link>
              <button
                type="submit"
                className="btn-primary flex-1 justify-center"
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
