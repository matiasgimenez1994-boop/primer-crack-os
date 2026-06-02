"use client";

import { useEffect, useState, useCallback } from"react";
import { useRouter } from"next/navigation";
import { useForm, useWatch } from"react-hook-form";
import { zodResolver } from"@hookform/resolvers/zod";
import { z } from"zod";
import Link from"next/link";
import { ArrowLeft, ShoppingBag } from"lucide-react";
import { createClient } from"@/lib/supabase/client";
import { toast } from"sonner";
import { formatCurrency, todayISO } from"@/lib/utils";
import type { GreenCoffee, Roaster, RoastBatch, Client } from"@/types";

const schema = z.object({
  product_type: z.enum(["roasted","green"]),
  roast_batch_id: z.string().optional(),
  weight_grams: z.coerce.number().optional(),
  green_coffee_id: z.string().optional(),
  green_weight_kg: z.coerce.number().positive().optional(),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().positive("El precio debe ser mayor a 0"),
  discount_type: z.enum(["pct","fixed"]),
  discount_value: z.coerce.number().min(0),
  client_id: z.string().optional(),
  payment_type: z.enum(["cash","transfer","credit"]),
  due_date: z.string().optional(),
  notes: z.string().optional(),
  sale_date: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

interface BatchOption {
  batch: RoastBatch & { green_coffees?: GreenCoffee };
  remainingKg: number;
}

const weightOptions = [
  { value: 250, label:"250 g" },
  { value: 500, label:"500 g" },
  { value: 1000, label:"1 kg" },
];

export default function NewSalePage() {
  const router = useRouter();
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [greenCoffees, setGreenCoffees] = useState<GreenCoffee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<BatchOption | null>(null);
  const [selectedGreen, setSelectedGreen] = useState<GreenCoffee | null>(null);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      product_type:"roasted",
      quantity: 1,
      discount_type:"pct",
      discount_value: 0,
      payment_type:"cash",
      sale_date: todayISO(),
      weight_grams: 250,
    },
  });

  const productType = watch("product_type");
  const watched = useWatch({ control });

  const loadBatches = useCallback(async (roasterId: string) => {
    const { data: batches } = await supabase
      .from("roast_batches")
      .select("*, green_coffees(*)")
      .eq("roaster_id", roasterId)
      .eq("status","production")
      .order("roast_date", { ascending: false });

    if (!batches) return;

    // Calcular stock tostado restante por lote
    const { data: salesData } = await supabase
      .from("sales")
      .select("roast_batch_id, weight_grams, quantity")
      .eq("roaster_id", roasterId)
      .eq("product_type","roasted");

    const soldByBatch: Record<string, number> = {};
    (salesData ?? []).forEach((s: { roast_batch_id: string; weight_grams: number; quantity: number }) => {
      if (!soldByBatch[s.roast_batch_id]) soldByBatch[s.roast_batch_id] = 0;
      soldByBatch[s.roast_batch_id] += (s.weight_grams / 1000) * s.quantity;
    });

    const options: BatchOption[] = batches.map((b) => ({
      batch: b,
      remainingKg: Math.max(0, b.roasted_weight_kg - (soldByBatch[b.id] ?? 0)),
    })).filter((o) => o.remainingKg > 0);

    setBatchOptions(options);
  }, [supabase]);

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
          loadBatches(r.id);
          supabase
            .from("green_coffees")
            .select("*")
            .eq("roaster_id", r.id)
            .neq("status","depleted")
            .order("name")
            .then(({ data: c }) => setGreenCoffees(c ?? []));
          supabase
            .from("clients")
            .select("*")
            .eq("roaster_id", r.id)
            .order("name")
            .then(({ data: c }) => setClients(c ?? []));
        });
    });
  }, [loadBatches]);

  // Pre-llenar precio cuando cambia el lote o el gramaje
  const batchId = watch("roast_batch_id");
  const weightGrams = watch("weight_grams");

  useEffect(() => {
    if (!batchId || !weightGrams) return;
    const option = batchOptions.find((o) => o.batch.id === batchId);
    if (!option) return;
    setSelectedBatch(option);

    // Buscar precio guardado en selling_prices
    supabase
      .from("selling_prices")
      .select("price")
      .eq("roast_batch_id", batchId)
      .eq("weight_grams", weightGrams)
      .single()
      .then(({ data }) => {
        if (data?.price) setValue("unit_price", data.price);
      });
  }, [batchId, weightGrams, batchOptions]);

  useEffect(() => {
    const greenId = watch("green_coffee_id");
    if (!greenId) return;
    const found = greenCoffees.find((c) => c.id === greenId);
    setSelectedGreen(found ?? null);
    if (found) setValue("unit_price", found.purchase_price_per_kg * 1.3); // sugerencia +30%
  }, [watch("green_coffee_id")]);

  // Calcular totales en tiempo real (descuento sobre el total)
  const unitPrice = Number(watched.unit_price) || 0;
  const qty = Number(watched.quantity) || 1;
  const subtotal = unitPrice * qty;
  const discountType = watched.discount_type ??"pct";
  const discountValue = Number(watched.discount_value) || 0;
  const discountAmount = discountType ==="pct"
    ? subtotal * (discountValue / 100)
    : Math.min(discountValue, subtotal);
  const discountPct = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  const discountedPrice = unitPrice; // precio unitario no cambia
  const totalFinal = Math.max(0, subtotal - discountAmount);

  let costPerUnit = 0;
  if (productType ==="roasted" && selectedBatch && watched.weight_grams) {
    costPerUnit = selectedBatch.batch.total_cost_per_kg_roasted * (Number(watched.weight_grams) / 1000);
  } else if (productType ==="green" && selectedGreen && watched.green_weight_kg) {
    costPerUnit = selectedGreen.purchase_price_per_kg * Number(watched.green_weight_kg);
  }
  const totalCost = costPerUnit * qty;
  const totalProfit = totalFinal - totalCost;
  const marginPct = totalFinal > 0 ? (totalProfit / totalFinal) * 100 : 0;

  async function onSubmit(data: FormData) {
    if (!roaster) return;

    if (data.product_type ==="roasted" && !data.roast_batch_id) {
      toast.error("Seleccioná un lote de tueste");
      return;
    }
    if (data.product_type ==="green" && !data.green_coffee_id) {
      toast.error("Seleccioná un café verde");
      return;
    }

    const sub = data.unit_price * data.quantity;
    const dAmount = data.discount_type ==="pct"
      ? sub * (data.discount_value / 100)
      : Math.min(data.discount_value, sub);
    const dPct = sub > 0 ? (dAmount / sub) * 100 : 0;
    const finalPrice = Math.max(0, sub - dAmount);
    const profit = finalPrice - costPerUnit * data.quantity;

    const { error } = await supabase.from("sales").insert({
      roaster_id: roaster.id,
      sale_date: data.sale_date,
      product_type: data.product_type,
      roast_batch_id: data.product_type ==="roasted" ? data.roast_batch_id : null,
      weight_grams: data.product_type ==="roasted" ? data.weight_grams : null,
      green_coffee_id: data.product_type ==="green" ? data.green_coffee_id : null,
      green_weight_kg: data.product_type ==="green" ? data.green_weight_kg : null,
      quantity: data.quantity,
      unit_price: data.unit_price,
      discount_pct: dPct,
      final_price: finalPrice,
      cost_per_unit: costPerUnit,
      profit,
      client_id: data.client_id || null,
      client_name: null,
      payment_type: data.payment_type,
      payment_status: data.payment_type ==="credit" ?"pending" :"paid",
      amount_paid: data.payment_type ==="credit" ? 0 : finalPrice,
      due_date: data.due_date || null,
      paid_at: data.payment_type !=="credit" ? new Date().toISOString() : null,
      notes: data.notes || null,
    });

    if (error) {
      toast.error("Error al guardar la venta");
      return;
    }

    // Descontar stock verde si es venta de verde
    if (data.product_type ==="green" && selectedGreen && data.green_weight_kg) {
      const totalKgSold = data.green_weight_kg * data.quantity;
      const newStock = Math.max(0, selectedGreen.current_stock_kg - totalKgSold);
      await supabase
        .from("green_coffees")
        .update({
          current_stock_kg: newStock,
          status: newStock === 0 ?"depleted" : selectedGreen.status,
        })
        .eq("id", selectedGreen.id);
    }

    toast.success("Venta registrada");
    router.push("/sales");
  }

  return (<div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="btn-ghost p-2">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="page-title">Registrar venta</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulario */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Tipo de producto */}
            <div className="card p-6">
              <p className="section-title">Tipo de venta</p>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${productType ==="roasted" ?"border-accent-green bg-[#FDF5EE]" :"border-border-default hover:border-accent-green/40"}`}>
                  <input type="radio" value="roasted" className="accent-accent-green" {...register("product_type")} />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Café tostado</p>
                    <p className="text-xs text-text-secondary">Bolsas de 250g, 500g, 1kg</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${productType ==="green" ?"border-accent-olive bg-[#F2F5EE]" :"border-border-default hover:border-accent-olive/40"}`}>
                  <input type="radio" value="green" className="accent-accent-olive" {...register("product_type")} />
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Café verde</p>
                    <p className="text-xs text-text-secondary">Venta por kg en verde</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Selección de producto */}
            <div className="card p-6">
              <p className="section-title">
                {productType ==="roasted" ?"Seleccioná el lote y presentación" :"Seleccioná el café verde"}
              </p>

              {productType ==="roasted" ? (<div className="flex flex-col gap-4">
                  <div>
                    <label className="label-base">Lote de tueste *</label>
                    <select className="input-base" {...register("roast_batch_id")}>
                      <option value="">Seleccionar lote...</option>
                      {batchOptions.map(({ batch, remainingKg }) => (<option key={batch.id} value={batch.id}>
                          {batch.green_coffees?.name} · {new Date(batch.roast_date).toLocaleDateString("es-UY")} · {remainingKg.toFixed(2)} kg disponibles
                        </option>))}
                    </select>
                    {batchOptions.length === 0 && (<p className="text-xs text-status-warning mt-1">
                        No hay lotes de producción con stock disponible
                      </p>)}
                  </div>

                  <div>
                    <label className="label-base">Presentación *</label>
                    <div className="flex gap-3">
                      {weightOptions.map((w) => (<label key={w.value} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${Number(watched.weight_grams) === w.value ?"border-accent-green bg-[#FDF5EE]" :"border-border-default hover:border-accent-green/40"}`}>
                          <input type="radio" value={w.value} className="sr-only" {...register("weight_grams")} />
                          <span className="text-sm font-semibold">{w.label}</span>
                        </label>))}
                    </div>
                  </div>

                  {selectedBatch && (<div className="p-3 bg-[#F5EFE6] rounded-lg text-xs grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-text-secondary">Costo/unidad</p>
                        <p className="font-mono font-medium">
                          {formatCurrency(selectedBatch.batch.total_cost_per_kg_roasted * (Number(watched.weight_grams ?? 250) / 1000), roaster?.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-text-secondary">Stock restante</p>
                        <p className="font-mono font-medium">{selectedBatch.remainingKg.toFixed(2)} kg</p>
                      </div>
                      <div>
                        <p className="text-text-secondary">Costo/kg</p>
                        <p className="font-mono font-medium">
                          {formatCurrency(selectedBatch.batch.total_cost_per_kg_roasted, roaster?.currency)}
                        </p>
                      </div>
                    </div>)}
                </div>) : (<div className="flex flex-col gap-4">
                  <div>
                    <label className="label-base">Café verde *</label>
                    <select className="input-base" {...register("green_coffee_id")}>
                      <option value="">Seleccionar café...</option>
                      {greenCoffees.map((c) => (<option key={c.id} value={c.id}>
                          {c.name} · {c.current_stock_kg.toFixed(2)} kg disponibles
                        </option>))}
                    </select>
                  </div>

                  <div>
                    <label className="label-base">Cantidad en kg *</label>
                    <input
                      type="number"
                      step="0.001"
                      className="input-base font-mono"
                      placeholder="5.000"
                      {...register("green_weight_kg")}
                    />
                    {selectedGreen && (<p className="text-xs text-text-secondary mt-1">
                        Stock disponible: {selectedGreen.current_stock_kg.toFixed(3)} kg · Precio compra: {formatCurrency(selectedGreen.purchase_price_per_kg, roaster?.currency)}/kg
                      </p>)}
                  </div>
                </div>)}
            </div>

            {/* Precio y cliente */}
            <div className="card p-6">
              <p className="section-title">Precio y cliente</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-base">
                    Precio de venta *
                    {productType ==="roasted" ? ` (por ${weightOptions.find(w => w.value === Number(watched.weight_grams))?.label ??"unidad"})` :" (por kg)"}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="input-base font-mono"
                    placeholder="0.00"
                    {...register("unit_price")}
                  />
                  {errors.unit_price && (<p className="text-xs text-status-danger mt-1">{errors.unit_price.message}</p>)}
                </div>

                <div>
                  <label className="label-base">Descuento</label>
                  <div className="flex gap-2">
                    {/* Selector tipo */}
                    <div className="flex rounded-lg border border-border-default overflow-hidden shrink-0">
                      <label className={`px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${discountType ==="pct" ?"bg-brand-dark text-white" :"bg-white text-text-secondary hover:bg-[#F5EFE6]"}`}>
                        <input type="radio" value="pct" className="sr-only" {...register("discount_type")} />
                        %
                      </label>
                      <label className={`px-3 py-2 text-xs font-medium cursor-pointer transition-colors border-l border-border-default ${discountType ==="fixed" ?"bg-brand-dark text-white" :"bg-white text-text-secondary hover:bg-[#F5EFE6]"}`}>
                        <input type="radio" value="fixed" className="sr-only" {...register("discount_type")} />
                        $
                      </label>
                    </div>
                    {/* Valor */}
                    <input
                      type="number"
                      step={discountType ==="pct" ?"0.5" :"0.01"}
                      min="0"
                      max={discountType ==="pct" ?"100" : undefined}
                      className="input-base font-mono flex-1"
                      placeholder="0"
                      {...register("discount_value")}
                    />
                  </div>
                  {discountAmount > 0 && subtotal > 0 && (<p className="text-xs text-status-warning mt-1">
                      -{formatCurrency(discountAmount, roaster?.currency)} sobre el total · Total: {formatCurrency(totalFinal, roaster?.currency)}
                    </p>)}
                </div>

                <div>
                  <label className="label-base">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    className="input-base font-mono"
                    {...register("quantity")}
                  />
                </div>

                <div>
                  <label className="label-base">Fecha</label>
                  <input type="date" className="input-base" {...register("sale_date")} />
                </div>

                <div>
                  <label className="label-base">Cliente</label>
                  <select className="input-base" {...register("client_id")}>
                    <option value="">Sin cliente asignado</option>
                    {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                  </select>
                  <Link href="/clients/new" className="text-xs text-accent-green hover:underline mt-1 inline-block">
                    + Crear nuevo cliente
                  </Link>
                </div>

                <div className="col-span-2">
                  <label className="label-base">Tipo de pago</label>
                  <div className="flex gap-2">
                    {[
                      { value:"cash", label:"Ÿ’µ Efectivo" },
                      { value:"transfer", label:"Ÿ¦ Transferencia" },
                      { value:"credit", label:"Ÿ“‹ A crédito" },
                    ].map((opt) => (<label key={opt.value}
                        className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors text-sm font-medium ${
                          watch("payment_type") === opt.value
                            ? opt.value ==="credit"
                              ?"border-orange-400 bg-orange-50 text-orange-700"
                              :"border-accent-olive bg-green-50 text-status-success"
                            :"border-border-default hover:border-text-secondary/30 text-text-secondary"
                        }`}
                      >
                        <input type="radio" value={opt.value} className="sr-only" {...register("payment_type")} />
                        {opt.label}
                      </label>))}
                  </div>
                </div>

                {watch("payment_type") ==="credit" && (<div className="col-span-2">
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <p className="text-xs font-medium text-orange-700 mb-2">
                        š ï¸ Esta venta quedará como pago pendiente
                      </p>
                      <label className="label-base">Fecha límite de pago (opcional)</label>
                      <input type="date" className="input-base bg-white" {...register("due_date")} />
                    </div>
                  </div>)}

                <div>
                  <label className="label-base">Notas</label>
                  <input
                    type="text"
                    className="input-base"
                    placeholder="Observaciones..."
                    {...register("notes")}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/sales" className="btn-secondary flex-1 justify-center">
                Cancelar
              </Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>
                {isSubmitting ?"Guardando..." :"Registrar venta"}
              </button>
            </div>
          </div>

          {/* Panel resumen */}
          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-accent-green" />
                <p className="text-sm font-semibold text-text-primary">Resumen</p>
              </div>

              {unitPrice === 0 ? (<p className="text-xs text-text-secondary">
                  Completá el precio para ver el resumen.
                </p>) : (<div className="flex flex-col gap-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Precio unitario</span>
                    <span className="font-mono">{formatCurrency(unitPrice, roaster?.currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Cantidad</span>
                    <span className="font-mono">× {qty}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="font-mono">{formatCurrency(subtotal, roaster?.currency)}</span>
                  </div>
                  {discountAmount > 0 && (<div className="flex justify-between text-xs">
                      <span className="text-text-secondary">
                        Descuento {discountType ==="pct" ? `(${discountValue}% del total)` :"fijo sobre total"}
                      </span>
                      <span className="font-mono text-status-warning">
                        -{formatCurrency(discountAmount, roaster?.currency)}
                      </span>
                    </div>)}

                  <div className="border-t border-border-default pt-3 flex justify-between">
                    <span className="text-sm font-semibold">Total venta</span>
                    <span className="text-sm font-mono font-bold text-text-primary">
                      {formatCurrency(totalFinal, roaster?.currency)}
                    </span>
                  </div>

                  {costPerUnit > 0 && (<>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Costo total</span>
                        <span className="font-mono">{formatCurrency(totalCost, roaster?.currency)}</span>
                      </div>
                      <div className="border-t border-border-default pt-3 flex justify-between">
                        <span className="text-sm font-semibold">Ganancia</span>
                        <span className={`text-sm font-mono font-bold ${totalProfit >= 0 ?"text-status-success" :"text-status-danger"}`}>
                          {formatCurrency(totalProfit, roaster?.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-text-secondary">Margen</span>
                        <span className={`font-mono font-semibold ${marginPct >= 40 ?"text-status-success" : marginPct >= 20 ?"text-status-warning" :"text-status-danger"}`}>
                          {marginPct.toFixed(1)}%
                        </span>
                      </div>
                    </>)}
                </div>)}
            </div>
          </div>
        </div>
      </form>
    </div>);
}

