"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Roaster } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  type: z.enum(["cafe", "individual", "restaurant", "distributor", "other"]),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
  inactive_alert_days: z.coerce.number().int().min(1),
});

type FormData = z.infer<typeof schema>;

export default function NewClientPage() {
  const router = useRouter();
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("*").eq("user_id", user.id).single()
        .then(({ data }) => setRoaster(data));
    });
  }, []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: "individual", inactive_alert_days: 30 },
  });

  async function onSubmit(data: FormData) {
    if (!roaster) return;
    const { error } = await supabase.from("clients").insert({
      roaster_id: roaster.id,
      ...data,
      email: data.email || null,
      phone: data.phone || null,
      notes: data.notes || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success(`${data.name} agregado`);
    router.push("/clients");
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/clients" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="page-title">Agregar cliente</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 flex flex-col gap-4">
            <p className="section-title">Información</p>

            <div>
              <label className="label-base">Nombre *</label>
              <input type="text" className="input-base" placeholder="Nombre o empresa" {...register("name")} />
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
              <input type="email" className="input-base" placeholder="cliente@email.com" {...register("email")} />
              {errors.email && <p className="text-xs text-status-danger mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label-base">Teléfono / WhatsApp</label>
              <input type="text" className="input-base" placeholder="+598 99 000 000" {...register("phone")} />
            </div>

            <div>
              <label className="label-base">Notas</label>
              <textarea className="input-base resize-none" rows={3} placeholder="Preferencias, observaciones..." {...register("notes")} />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="card p-6">
              <p className="section-title">Alerta de inactividad</p>
              <p className="text-xs text-text-secondary mb-4">
                Te avisamos si este cliente no compra en el tiempo configurado
              </p>
              <div>
                <label className="label-base">Alertar si no compra en (días)</label>
                <input type="number" min="1" className="input-base font-mono w-32" {...register("inactive_alert_days")} />
                <p className="text-xs text-text-secondary mt-1">
                  Recomendado: 30 días para cafeterías, 60 para consumidores
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/clients" className="btn-secondary flex-1 justify-center">Cancelar</Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar cliente"}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
