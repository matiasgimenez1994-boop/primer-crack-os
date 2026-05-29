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
import { todayISO } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_ICONS, FREQUENCY_LABELS } from "@/lib/expenses";
import type { Roaster } from "@/types";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  category: z.enum(["energy","rent","packaging","maintenance","labor","marketing","supplies","other"]),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  frequency: z.enum(["once","daily","weekly","monthly","yearly"]),
  expense_date: z.string().min(1),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const QUICK_EXPENSES = [
  { name: "Gas / Energía tostadora", category: "energy", frequency: "monthly" },
  { name: "Alquiler local", category: "rent", frequency: "monthly" },
  { name: "Bolsas y etiquetas", category: "packaging", frequency: "monthly" },
  { name: "Mantenimiento tostadora", category: "maintenance", frequency: "yearly" },
  { name: "Mano de obra", category: "labor", frequency: "monthly" },
];

export default function NewExpensePage() {
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

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { category: "energy", frequency: "monthly", expense_date: todayISO() },
  });

  async function onSubmit(data: FormData) {
    if (!roaster) return;
    const { error } = await supabase.from("expenses").insert({
      roaster_id: roaster.id, ...data, notes: data.notes || null,
    });
    if (error) { toast.error("Error al guardar"); return; }
    toast.success("Gasto registrado");
    router.push("/expenses");
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/expenses" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-xl font-semibold text-text-primary">Registrar gasto</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Datos del gasto</p>

              <div>
                <label className="label-base">Descripción *</label>
                <input type="text" className="input-base" placeholder="Ej: Gas mayo, Bolsas kraft..." {...register("name")} />
                {errors.name && <p className="text-xs text-status-danger mt-1">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Categoría</label>
                  <select className="input-base" {...register("category")}>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{CATEGORY_ICONS[k as keyof typeof CATEGORY_ICONS]} {v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label-base">Frecuencia</label>
                  <select className="input-base" {...register("frequency")}>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Monto *</label>
                  <input type="number" step="0.01" className="input-base font-mono" placeholder="0.00" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-status-danger mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="label-base">Fecha</label>
                  <input type="date" className="input-base" {...register("expense_date")} />
                </div>
              </div>

              <div>
                <label className="label-base">Notas</label>
                <textarea className="input-base resize-none" rows={2} placeholder="Observaciones..." {...register("notes")} />
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/expenses" className="btn-secondary flex-1 justify-center">Cancelar</Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Guardar gasto"}
              </button>
            </div>
          </form>
        </div>

        {/* Gastos frecuentes */}
        <div className="card p-5 h-fit">
          <p className="section-title">Gastos frecuentes</p>
          <p className="text-xs text-text-secondary mb-3">Click para pre-completar el formulario</p>
          <div className="flex flex-col gap-2">
            {QUICK_EXPENSES.map((q) => (
              <button key={q.name} type="button"
                onClick={() => {
                  setValue("name", q.name);
                  setValue("category", q.category as FormData["category"]);
                  setValue("frequency", q.frequency as FormData["frequency"]);
                }}
                className="text-left p-3 rounded-lg border border-border-default hover:border-accent-green/40 hover:bg-[#F5EFE6] transition-colors"
              >
                <p className="text-sm font-medium text-text-primary">
                  {CATEGORY_ICONS[q.category as keyof typeof CATEGORY_ICONS]} {q.name}
                </p>
                <p className="text-xs text-text-secondary mt-0.5">
                  {CATEGORY_LABELS[q.category as keyof typeof CATEGORY_LABELS]} · {FREQUENCY_LABELS[q.frequency as keyof typeof FREQUENCY_LABELS]}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

