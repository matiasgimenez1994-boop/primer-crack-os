"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { todayISO, formatCurrency } from "@/lib/utils";
import type { Client, GreenCoffee, Roaster } from "@/types";

const itemSchema = z.object({
  product_type: z.enum(["roasted", "green"]),
  green_coffee_id: z.string().min(1, "Seleccioná un café"),
  weight_grams: z.coerce.number().optional().or(z.literal("")),
  green_weight_kg: z.coerce.number().positive().optional().or(z.literal("")),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().min(0),
  notes: z.string().optional(),
});

const schema = z.object({
  client_id: z.string().optional(),
  client_name: z.string().optional(),
  order_date: z.string().min(1),
  delivery_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Agregá al menos un producto"),
});

type FormData = z.infer<typeof schema>;

const WEIGHT_OPTIONS = [
  { value: 250, label: "250 g" },
  { value: 500, label: "500 g" },
  { value: 1000, label: "1 kg" },
];

export default function NewOrderPage() {
  const router = useRouter();
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [coffees, setCoffees] = useState<GreenCoffee[]>([]);

  const { register, handleSubmit, control, watch, setValue,
    formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      order_date: todayISO(),
      items: [{ product_type: "roasted", green_coffee_id: "", quantity: 1, unit_price: 0, weight_grams: 250 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("*").eq("user_id", user.id).single()
        .then(({ data: r }) => {
          if (!r) return;
          setRoaster(r);
          Promise.all([
            supabase.from("clients").select("*").eq("roaster_id", r.id).order("name"),
            supabase.from("green_coffees").select("*").eq("roaster_id", r.id).neq("status","depleted").order("name"),
          ]).then(([{ data: c }, { data: cf }]) => {
            setClients(c ?? []);
            setCoffees(cf ?? []);
          });
        });
    });
  }, []);

  const total = watchedItems.reduce((sum, item) => {
    const price = Number(item.unit_price) || 0;
    const qty = Number(item.quantity) || 1;
    return sum + price * qty;
  }, 0);

  async function onSubmit(data: FormData) {
    if (!roaster) return;

    const selectedClient = clients.find(c => c.id === data.client_id);
    const totalAmount = data.items.reduce((s, i) => s + Number(i.unit_price) * Number(i.quantity), 0);

    const { data: order, error } = await supabase
      .from("orders").insert({
        roaster_id: roaster.id,
        client_id: data.client_id || null,
        client_name: selectedClient?.name ?? data.client_name ?? null,
        order_date: data.order_date,
        delivery_date: data.delivery_date || null,
        notes: data.notes || null,
        total_amount: totalAmount,
        status: "pending",
      }).select().single();

    if (error || !order) { toast.error("Error al crear el pedido"); return; }

    const items = data.items.map(i => ({
      order_id: order.id,
      green_coffee_id: i.green_coffee_id || null,
      product_type: i.product_type,
      weight_grams: i.product_type === "roasted" ? Number(i.weight_grams) || 250 : null,
      green_weight_kg: i.product_type === "green" ? Number(i.green_weight_kg) || null : null,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      notes: i.notes || null,
    }));

    await supabase.from("order_items").insert(items);
    toast.success("Pedido creado");
    router.push(`/orders/${order.id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="text-xl font-semibold text-text-primary">Nuevo pedido</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Cliente y fechas */}
            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Datos del pedido</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-base">Cliente</label>
                  <select className="input-base" {...register("client_id")}>
                    <option value="">Sin cliente / cliente nuevo</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                {!watch("client_id") && (
                  <div className="col-span-2">
                    <label className="label-base">Nombre del cliente (si no está en la lista)</label>
                    <input type="text" className="input-base" placeholder="Nombre o empresa"
                      {...register("client_name")} />
                  </div>
                )}
                <div>
                  <label className="label-base">Fecha del pedido</label>
                  <input type="date" className="input-base" {...register("order_date")} />
                </div>
                <div>
                  <label className="label-base">Fecha de entrega</label>
                  <input type="date" className="input-base" {...register("delivery_date")} />
                </div>
              </div>
              <div>
                <label className="label-base">Notas del pedido</label>
                <textarea className="input-base resize-none" rows={2}
                  placeholder="Instrucciones especiales, dirección de entrega..."
                  {...register("notes")} />
              </div>
            </div>

            {/* Items del pedido */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="section-title mb-0">Productos</p>
                <button type="button"
                  onClick={() => append({ product_type: "roasted", green_coffee_id: "", quantity: 1, unit_price: 0, weight_grams: 250 })}
                  className="btn-secondary text-xs">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </div>

              {errors.items?.root && (
                <p className="text-xs text-status-danger mb-3">{errors.items.root.message}</p>
              )}

              <div className="flex flex-col gap-4">
                {fields.map((field, idx) => {
                  const item = watchedItems[idx];
                  return (
                    <div key={field.id} className="border border-border-default rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-secondary">Item {idx + 1}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(idx)}
                            className="text-status-danger hover:bg-red-50 p-1 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Tipo */}
                      <div className="flex gap-2">
                        {[{ v: "roasted", l: "â˜• Tostado" }, { v: "green", l: "ðŸŒ± Verde" }].map(opt => (
                          <label key={opt.v}
                            className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium transition-colors ${
                              item?.product_type === opt.v
                                ? "border-accent-green bg-[#FDF5EE] text-accent-green"
                                : "border-border-default text-text-secondary hover:border-accent-green/30"
                            }`}>
                            <input type="radio" value={opt.v} className="sr-only"
                              {...register(`items.${idx}.product_type`)} />
                            {opt.l}
                          </label>
                        ))}
                      </div>

                      {/* Café */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="label-base">Café</label>
                          <select className="input-base" {...register(`items.${idx}.green_coffee_id`)}>
                            <option value="">Seleccionar...</option>
                            {coffees.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>

                        {item?.product_type === "roasted" ? (
                          <div>
                            <label className="label-base">Presentación</label>
                            <select className="input-base" {...register(`items.${idx}.weight_grams`)}>
                              {WEIGHT_OPTIONS.map(w => (
                                <option key={w.value} value={w.value}>{w.label}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="label-base">Cantidad (kg)</label>
                            <input type="number" step="0.001" className="input-base font-mono"
                              placeholder="5.000" {...register(`items.${idx}.green_weight_kg`)} />
                          </div>
                        )}

                        <div>
                          <label className="label-base">Cantidad</label>
                          <input type="number" min="1" className="input-base font-mono"
                            {...register(`items.${idx}.quantity`)} />
                        </div>

                        <div>
                          <label className="label-base">Precio unitario</label>
                          <input type="number" step="0.01" min="0" className="input-base font-mono"
                            placeholder="0.00" {...register(`items.${idx}.unit_price`)} />
                        </div>

                        <div className="col-span-2">
                          <label className="label-base">Notas del item</label>
                          <input type="text" className="input-base"
                            placeholder="Molido, sin tostar, urgente..."
                            {...register(`items.${idx}.notes`)} />
                        </div>
                      </div>

                      {/* Subtotal del item */}
                      <div className="flex justify-end text-xs text-text-secondary">
                        Subtotal:{" "}
                        <span className="font-mono font-medium text-text-primary ml-1">
                          {formatCurrency((Number(item?.unit_price) || 0) * (Number(item?.quantity) || 1), roaster?.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/orders" className="btn-secondary flex-1 justify-center">Cancelar</Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Crear pedido"}
              </button>
            </div>
          </div>

          {/* Panel resumen */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-6">
              <p className="text-sm font-semibold text-text-primary mb-4">Resumen</p>
              <div className="flex flex-col gap-2 text-sm mb-4">
                {fields.map((_, idx) => {
                  const item = watchedItems[idx];
                  const coffee = coffees.find(c => c.id === item?.green_coffee_id);
                  const subtotal = (Number(item?.unit_price) || 0) * (Number(item?.quantity) || 1);
                  if (!coffee) return null;
                  return (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-text-secondary truncate max-w-[140px]">
                        {item?.quantity}í— {coffee?.name}
                        {item?.product_type === "roasted" && item?.weight_grams ? ` ${item.weight_grams}g` : ""}
                      </span>
                      <span className="font-mono shrink-0 ml-2">
                        {formatCurrency(subtotal, roaster?.currency)}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border-default pt-3 flex justify-between">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-sm font-mono font-bold text-accent-green">
                  {formatCurrency(total, roaster?.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

