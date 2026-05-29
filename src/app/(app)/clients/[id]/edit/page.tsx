"use client";

import { useEffect, useState } from"react";
import { useRouter, useParams } from"next/navigation";
import { useForm } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import Link from"next/link";
import { ArrowLeft, Trash2 } from"lucide-react";
import { createClient } from"@/lib/supabase/client";
import { toast } from"sonner";
import type { Roaster } from"@/types";

const schema = z.object({
  name: z.string().min(1,"El nombre es requerido"),
  type: z.enum(["cafe","individual","restaurant","distributor","other"]),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
  inactive_alert_days: z.coerce.number().int().min(1),
});

type FormData = z.infer<typeof schema>;

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("*").eq("user_id", user.id).single()
        .then(({ data: r }) => {
          if (!r) return;
          setRoaster(r);
          supabase.from("clients").select("*").eq("id", id).eq("roaster_id", r.id).single()
            .then(({ data: c }) => {
              if (!c) return;
              reset({ ...c, email: c.email ??"", phone: c.phone ??"", notes: c.notes ??"" });
              setLoading(false);
            });
        });
    });
  }, [id]);

  async function onSubmit(data: FormData) {
    const { error } = await supabase.from("clients").update({
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
    }).eq("id", id);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Cliente actualizado");
    router.push(`/clients/${id}`);
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este cliente? Sus ventas asociadas quedarán sin cliente asignado.")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error("Error al eliminar"); return; }
    toast.success("Cliente eliminado");
    router.push("/clients");
  }

  if (loading) return (<div className="flex items-center justify-center min-h-[300px]">
      <div className="w-6 h-6 border-2 border-border-default border-t-accent-terra rounded-full animate-spin" />
    </div>);

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href={`/clients/${id}`} className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="page-title">Editar cliente</h1>
        </div>
        <button onClick={handleDelete} className="btn-ghost text-status-danger hover:bg-red-50">
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 flex flex-col gap-4">
            <p className="section-title">Información</p>
            <div>
              <label className="label-base">Nombre *</label>
              <input type="text" className="input-base" {...register("name")} />
              {errors.name && <p className="text-xs text-status-danger mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label-base">Tipo</label>
              <select className="input-base" {...register("type")}>
                <option value="individual">Consumidor final</option>
                <option value="cafe">Cafetería</option>
                <option value="restaurant">Restaurante</option>
                <option value="distributor">Distribuidor</option>
                <option value="other">Otro</option>
              </select>
            </div>
            <div>
              <label className="label-base">Email</label>
              <input type="email" className="input-base" {...register("email")} />
            </div>
            <div>
              <label className="label-base">Teléfono / WhatsApp</label>
              <input type="text" className="input-base" {...register("phone")} />
            </div>
            <div>
              <label className="label-base">Notas</label>
              <textarea className="input-base resize-none" rows={3} {...register("notes")} />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="card p-6">
              <p className="section-title">Alerta de inactividad</p>
              <div>
                <label className="label-base">Alertar si no compra en (días)</label>
                <input type="number" min="1" className="input-base font-mono w-32" {...register("inactive_alert_days")} />
              </div>
            </div>
            <div className="flex gap-3">
              <Link href={`/clients/${id}`} className="btn-secondary flex-1 justify-center">Cancelar</Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting || !isDirty}>
                {isSubmitting ?"Guardando..." :"Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>);
}
