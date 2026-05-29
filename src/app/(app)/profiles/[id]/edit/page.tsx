"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Trash2, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { GreenCoffee } from "@/types";

const schema = z.object({
  name: z.string().min(1),
  green_coffee_id: z.string().optional(),
  roaster_machine: z.string().optional(),
  charge_kg: z.coerce.number().optional().or(z.literal("")),
  charge_temp_celsius: z.coerce.number().optional().or(z.literal("")),
  total_time_min: z.coerce.number().optional().or(z.literal("")),
  first_crack_time_min: z.coerce.number().optional().or(z.literal("")),
  development_time_min: z.coerce.number().optional().or(z.literal("")),
  roast_level: z.enum(["light","medium","medium_dark","dark"]).optional().or(z.literal("")),
  cup_result: z.string().optional(),
  recommendation: z.string().optional(),
  is_favorite: z.boolean(),
});

type FormData = z.infer<typeof schema>;

export default function EditProfilePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [coffees, setCoffees] = useState<GreenCoffee[]>([]);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, reset, watch,
    formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("id").eq("user_id", user.id).single()
        .then(({ data: r }) => {
          if (!r) return;
          supabase.from("green_coffees").select("*").eq("roaster_id", r.id).order("name")
            .then(({ data: c }) => setCoffees(c ?? []));
          supabase.from("roast_profiles").select("*").eq("id", id).eq("roaster_id", r.id).single()
            .then(({ data: p }) => {
              if (!p) return;
              reset({
                ...p,
                green_coffee_id: p.green_coffee_id ?? "",
                charge_kg: p.charge_kg ?? "",
                charge_temp_celsius: p.charge_temp_celsius ?? "",
                total_time_min: p.total_time_min ?? "",
                first_crack_time_min: p.first_crack_time_min ?? "",
                development_time_min: p.development_time_min ?? "",
                roast_level: p.roast_level ?? "",
                cup_result: p.cup_result ?? "",
                recommendation: p.recommendation ?? "",
              });
              setLoading(false);
            });
        });
    });
  }, [id]);

  async function onSubmit(data: FormData) {
    const { error } = await supabase.from("roast_profiles").update({
      ...data,
      green_coffee_id: data.green_coffee_id || null,
      charge_kg: data.charge_kg || null,
      charge_temp_celsius: data.charge_temp_celsius || null,
      total_time_min: data.total_time_min || null,
      first_crack_time_min: data.first_crack_time_min || null,
      development_time_min: data.development_time_min || null,
      roast_level: data.roast_level || null,
    }).eq("id", id);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Perfil actualizado");
    router.push(`/profiles/${id}`);
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este perfil?")) return;
    await supabase.from("roast_profiles").delete().eq("id", id);
    toast.success("Perfil eliminado");
    router.push("/profiles");
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[300px]">
      <div className="w-6 h-6 border-2 border-border-default border-t-accent-terra rounded-full animate-spin" />
    </div>
  );

  const isFavorite = watch("is_favorite");

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={`/profiles/${id}`} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-xl font-semibold text-text-primary">Editar perfil</h1>
        </div>
        <button onClick={handleDelete} className="btn-ghost text-status-danger hover:bg-red-50">
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-5">
            <div className="card p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="section-title mb-0">Identificación</p>
                <label className={`flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-lg border transition-colors text-xs font-medium ${isFavorite ? "border-yellow-300 bg-yellow-50 text-yellow-700" : "border-border-default text-text-secondary hover:bg-[#F5EFE6]"}`}>
                  <input type="checkbox" className="sr-only" {...register("is_favorite")} />
                  <Star className={`w-3.5 h-3.5 ${isFavorite ? "fill-yellow-500 text-yellow-500" : ""}`} />
                  Favorito
                </label>
              </div>
              <div>
                <label className="label-base">Nombre *</label>
                <input type="text" className="input-base" {...register("name")} />
              </div>
              <div>
                <label className="label-base">Café asociado</label>
                <select className="input-base" {...register("green_coffee_id")}>
                  <option value="">Ninguno</option>
                  {coffees.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Tostadora</label>
                  <input type="text" className="input-base" {...register("roaster_machine")} />
                </div>
                <div>
                  <label className="label-base">Carga (kg)</label>
                  <input type="number" step="0.001" className="input-base font-mono" {...register("charge_kg")} />
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
              <div>
                <label className="label-base">Resultado en taza</label>
                <textarea className="input-base resize-none" rows={2} {...register("cup_result")} />
              </div>
              <div>
                <label className="label-base">Recomendación</label>
                <textarea className="input-base resize-none" rows={2} {...register("recommendation")} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Parámetros técnicos</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Temp. carga (°C)</label>
                  <input type="number" step="0.5" className="input-base font-mono" {...register("charge_temp_celsius")} />
                </div>
                <div>
                  <label className="label-base">Tiempo total (min)</label>
                  <input type="number" step="0.1" className="input-base font-mono" {...register("total_time_min")} />
                </div>
                <div>
                  <label className="label-base">1er crack (min)</label>
                  <input type="number" step="0.1" className="input-base font-mono" {...register("first_crack_time_min")} />
                </div>
                <div>
                  <label className="label-base">Desarrollo (min)</label>
                  <input type="number" step="0.1" className="input-base font-mono" {...register("development_time_min")} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href={`/profiles/${id}`} className="btn-secondary flex-1 justify-center">Cancelar</Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting || !isDirty}>
                {isSubmitting ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
