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
import { CATEGORY_LABELS, CATEGORY_ICONS, FREQUENCY_LABELS } from"@/lib/expenses";

const schema = z.object({
  name: z.string().min(1),
  category: z.enum(["energy","rent","packaging","maintenance","labor","marketing","supplies","other"]),
  amount: z.coerce.number().positive(),
  frequency: z.enum(["once","daily","weekly","monthly","yearly"]),
  expense_date: z.string().min(1),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function EditExpensePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [roasterId, setRoasterId] = useState<string>("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("id").eq("user_id", user.id).single()
        .then(({ data: r }) => {
          if (!r) return;
          setRoasterId(r.id);
          supabase.from("expenses").select("*").eq("id", id).eq("roaster_id", r.id).single()
            .then(({ data: e }) => {
              if (!e) return;
              reset({ ...e, notes: e.notes ??"" });
              setLoading(false);
            });
        });
    });
  }, [id]);

  async function onSubmit(data: FormData) {
    const { error } = await supabase.from("expenses").update({
      ...data, notes: data.notes || null,
    }).eq("id", id);
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Gasto actualizado");
    router.push("/expenses");
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este gasto?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    toast.success("Gasto eliminado");
    router.push("/expenses");
  }

  if (loading) return (<div className="flex items-center justify-center min-h-[300px]">
      <div className="w-6 h-6 border-2 border-border-default border-t-accent-terra rounded-full animate-spin" />
    </div>);

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/expenses" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-xl font-semibold text-text-primary">Editar gasto</h1>
        </div>
        <button onClick={handleDelete} className="btn-ghost text-status-danger hover:bg-red-50">
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card p-6 max-w-2xl flex flex-col gap-4">
          <div>
            <label className="label-base">Descripción *</label>
            <input type="text" className="input-base" {...register("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Categoría</label>
              <select className="input-base" {...register("category")}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{CATEGORY_ICONS[k as keyof typeof CATEGORY_ICONS]} {v}</option>))}
              </select>
            </div>
            <div>
              <label className="label-base">Frecuencia</label>
              <select className="input-base" {...register("frequency")}>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">Monto *</label>
              <input type="number" step="0.01" className="input-base font-mono" {...register("amount")} />
            </div>
            <div>
              <label className="label-base">Fecha</label>
              <input type="date" className="input-base" {...register("expense_date")} />
            </div>
          </div>
          <div>
            <label className="label-base">Notas</label>
            <textarea className="input-base resize-none" rows={2} {...register("notes")} />
          </div>
          <div className="flex gap-3 pt-2">
            <Link href="/expenses" className="btn-secondary flex-1 justify-center">Cancelar</Link>
            <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting || !isDirty}>
              {isSubmitting ?"Guardando..." :"Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>);
}
