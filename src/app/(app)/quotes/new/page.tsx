"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { calculateQuoteTotals, nextQuoteNumber, QUOTE_CATEGORY_LABELS, QUOTE_KIND_LABELS } from "@/lib/quotes";
import { formatCurrency, todayISO } from "@/lib/utils";
import type { Client, GreenCoffee, QuoteCategory, QuoteItemKind, QuotePriceCatalogItem, Roaster } from "@/types";

const itemSchema = z.object({
  catalog_item_id: z.string().optional(),
  green_coffee_id: z.string().optional(),
  item_kind: z.enum(["green_coffee", "roast_service", "machine", "destoner", "other"]),
  description: z.string().min(1, "Ingresá una descripción"),
  quantity: z.coerce.number().positive("La cantidad debe ser mayor a 0"),
  unit_label: z.string().min(1),
  unit_price: z.coerce.number().min(0),
  tax_enabled: z.boolean(),
  tax_rate: z.coerce.number().min(0),
});

const schema = z.object({
  category: z.enum(["green_coffee", "brand_creation", "machines"]),
  client_id: z.string().optional(),
  client_name: z.string().optional(),
  client_email: z.string().optional(),
  currency: z.enum(["USD", "UYU"]),
  quote_date: z.string().min(1),
  valid_until: z.string().optional(),
  tax_enabled: z.boolean(),
  tax_rate: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1, "Agregá al menos un renglón"),
});

type FormData = z.infer<typeof schema>;

const defaultItem = {
  catalog_item_id: "",
  green_coffee_id: "",
  item_kind: "green_coffee" as QuoteItemKind,
  description: "",
  quantity: 1,
  unit_label: "kg",
  unit_price: 0,
  tax_enabled: true,
  tax_rate: 22,
};

export default function NewQuotePage() {
  const router = useRouter();
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [coffees, setCoffees] = useState<GreenCoffee[]>([]);
  const [catalog, setCatalog] = useState<QuotePriceCatalogItem[]>([]);
  const [existingCount, setExistingCount] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      category: "green_coffee",
      currency: "USD",
      quote_date: todayISO(),
      tax_enabled: true,
      tax_rate: 22,
      items: [defaultItem],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });
  const category = watch("category");
  const taxEnabled = watch("tax_enabled");
  const defaultTaxRate = watch("tax_rate");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("*").eq("user_id", user.id).single()
        .then(({ data: r }) => {
          if (!r) return;
          setRoaster(r);
          setValue("currency", r.currency === "UYU" ? "UYU" : "USD");
          Promise.all([
            supabase.from("clients").select("*").eq("roaster_id", r.id).order("name"),
            supabase.from("green_coffees").select("*").eq("roaster_id", r.id).neq("status", "depleted").order("name"),
            supabase.from("quote_price_catalog").select("*, green_coffees(name)").eq("roaster_id", r.id).eq("active", true).order("category").order("sort_order").order("name"),
            supabase.from("quotations").select("id", { count: "exact", head: true }).eq("roaster_id", r.id),
          ]).then(([{ data: clientRows }, { data: coffeeRows }, { data: catalogRows }, { count }]) => {
            setClients(clientRows ?? []);
            setCoffees(coffeeRows ?? []);
            setCatalog(catalogRows ?? []);
            setExistingCount(count ?? 0);
          });
        });
    });
  }, []);

  const categoryCatalog = catalog.filter((item) => item.category === category);
  const totals = useMemo(() => {
    const items = (watched.items ?? []).map((item) => ({
      quantity: Number(item?.quantity) || 0,
      unit_price: Number(item?.unit_price) || 0,
      tax_enabled: Boolean(item?.tax_enabled),
      tax_rate: Number(item?.tax_rate) || 0,
    }));
    return calculateQuoteTotals(items, Boolean(watched.tax_enabled), Number(watched.tax_rate) || 0);
  }, [watched.items, watched.tax_enabled, watched.tax_rate]);

  function applyCatalogItem(index: number, itemId: string) {
    const item = catalog.find((row) => row.id === itemId);
    if (!item) return;
    setValue(`items.${index}.catalog_item_id`, item.id);
    setValue(`items.${index}.green_coffee_id`, item.green_coffee_id ?? "");
    setValue(`items.${index}.item_kind`, item.item_kind);
    setValue(`items.${index}.description`, item.description ? `${item.name} - ${item.description}` : item.name);
    setValue(`items.${index}.unit_label`, item.unit_label);
    setValue(`items.${index}.unit_price`, item.suggested_unit_price);
    setValue(`items.${index}.tax_enabled`, item.item_kind !== "roast_service");
    setValue(`items.${index}.tax_rate`, defaultTaxRate || 22);
  }

  function applyGreenCoffee(index: number, coffeeId: string) {
    const coffee = coffees.find((row) => row.id === coffeeId);
    if (!coffee) return;
    setValue(`items.${index}.green_coffee_id`, coffee.id);
    setValue(`items.${index}.item_kind`, "green_coffee");
    setValue(`items.${index}.description`, coffee.name);
    setValue(`items.${index}.unit_label`, "kg");
    setValue(`items.${index}.unit_price`, Number(coffee.purchase_price_per_kg) || 0);
    setValue(`items.${index}.tax_enabled`, true);
    setValue(`items.${index}.tax_rate`, defaultTaxRate || 22);
  }

  function addBrandCreationLines() {
    append({
      catalog_item_id: "",
      green_coffee_id: "",
      item_kind: "green_coffee",
      description: "Cafe verde para Crea tu Marca",
      quantity: 1,
      unit_label: "kg",
      unit_price: 0,
      tax_enabled: true,
      tax_rate: defaultTaxRate || 22,
    });
    append({
      catalog_item_id: "",
      green_coffee_id: "",
      item_kind: "roast_service",
      description: "Servicio de tueste Crea tu Marca",
      quantity: 1,
      unit_label: "servicio",
      unit_price: 0,
      tax_enabled: false,
      tax_rate: defaultTaxRate || 22,
    });
  }

  function addRoastServiceFromGreenLine() {
    const greenLine = (watched.items ?? []).find((item) => item?.item_kind === "green_coffee");
    append({
      catalog_item_id: "",
      green_coffee_id: greenLine?.green_coffee_id ?? "",
      item_kind: "roast_service",
      description: "Servicio de tueste",
      quantity: Number(greenLine?.quantity) || 1,
      unit_label: "kg",
      unit_price: 5,
      tax_enabled: false,
      tax_rate: defaultTaxRate || 22,
    });
  }

  function applyTaxEnabledToAll(enabled: boolean) {
    setValue("tax_enabled", enabled);
    (watched.items ?? []).forEach((_, index) => {
      setValue(`items.${index}.tax_enabled`, enabled);
    });
  }

  function applyTaxRateToAll(rate: number) {
    setValue("tax_rate", rate);
    (watched.items ?? []).forEach((_, index) => {
      setValue(`items.${index}.tax_rate`, rate);
    });
  }

  async function onSubmit(data: FormData) {
    if (!roaster) return;
    if (!data.client_id && !data.client_name?.trim()) {
      toast.error("Seleccioná un cliente o ingresá un nombre");
      return;
    }

    const selectedClient = clients.find((client) => client.id === data.client_id);
    const quoteNumber = nextQuoteNumber(existingCount);
    const calculated = calculateQuoteTotals(data.items, data.tax_enabled, data.tax_rate);

    const { data: quote, error } = await supabase.from("quotations").insert({
      roaster_id: roaster.id,
      quote_number: quoteNumber,
      category: data.category,
      status: "issued",
      client_id: data.client_id || null,
      client_name: selectedClient?.name ?? data.client_name ?? null,
      client_email: selectedClient?.email ?? data.client_email ?? null,
      currency: data.currency,
      quote_date: data.quote_date,
      valid_until: data.valid_until || null,
      tax_enabled: data.tax_enabled,
      tax_rate: data.tax_rate,
      subtotal_amount: calculated.subtotal,
      tax_amount: calculated.taxAmount,
      total_amount: calculated.total,
      notes: data.notes || null,
      issued_at: new Date().toISOString(),
    }).select().single();

    if (error || !quote) {
      toast.error("Error al crear la cotización");
      return;
    }

    const items = data.items.map((item, index) => {
      const lineSubtotal = Number(item.quantity) * Number(item.unit_price);
      const lineTax = item.tax_enabled ? lineSubtotal * (Number(item.tax_rate) / 100) : 0;
      return {
        quotation_id: quote.id,
        catalog_item_id: item.catalog_item_id || null,
        green_coffee_id: item.green_coffee_id || null,
        item_kind: item.item_kind,
        description: item.description,
        quantity: Number(item.quantity),
        unit_label: item.unit_label,
        unit_price: Number(item.unit_price),
        line_subtotal: lineSubtotal,
        tax_enabled: item.tax_enabled,
        tax_rate: item.tax_enabled ? Number(item.tax_rate) : 0,
        tax_amount: lineTax,
        line_total: lineSubtotal + lineTax,
        sort_order: index,
      };
    });

    const { error: itemError } = await supabase.from("quotation_items").insert(items);
    if (itemError) {
      toast.error("La cotización se creó, pero falló al guardar los renglones");
      return;
    }

    toast.success("Cotización emitida");
    router.push(`/quotes/${quote.id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="page-title">Nueva cotización</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="card p-6">
              <p className="section-title">Tipo de cotización</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["green_coffee", "brand_creation", "machines"] as QuoteCategory[]).map((value) => (
                  <label key={value} className={`p-4 rounded-xl border-2 cursor-pointer transition-colors ${category === value ? "border-accent-green bg-green-50" : "border-border-default hover:border-accent-green/40"}`}>
                    <input type="radio" value={value} className="sr-only" {...register("category")} />
                    <span className="text-sm font-semibold">{QUOTE_CATEGORY_LABELS[value]}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="card p-6 flex flex-col gap-4">
              <p className="section-title">Cliente y condiciones</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label-base">Cliente</label>
                  <select className="input-base" {...register("client_id")}>
                    <option value="">Cliente nuevo / sin asignar</option>
                    {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                  </select>
                </div>
                {!watch("client_id") && (
                  <>
                    <div>
                      <label className="label-base">Nombre cliente</label>
                      <input className="input-base" placeholder="Empresa o contacto" {...register("client_name")} />
                    </div>
                    <div>
                      <label className="label-base">Email</label>
                      <input className="input-base" placeholder="cliente@email.com" {...register("client_email")} />
                    </div>
                  </>
                )}
                <div>
                  <label className="label-base">Moneda</label>
                  <select className="input-base" {...register("currency")}>
                    <option value="USD">Dólares estadounidenses (USD)</option>
                    <option value="UYU">Pesos uruguayos (UYU)</option>
                  </select>
                </div>
                <div>
                  <label className="label-base">Fecha</label>
                  <input type="date" className="input-base" {...register("quote_date")} />
                </div>
                <div>
                  <label className="label-base">Válida hasta</label>
                  <input type="date" className="input-base" {...register("valid_until")} />
                </div>
                <div>
                  <label className="label-base">IVA por defecto</label>
                  <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border-default cursor-pointer">
                    <input type="checkbox" className="accent-accent-green" checked={taxEnabled} onChange={(event) => applyTaxEnabledToAll(event.target.checked)} />
                    <span className="text-sm">Aplicar IVA</span>
                  </label>
                </div>
                <div>
                  <label className="label-base">Alícuota por defecto (%)</label>
                  <input type="number" step="0.1" disabled={!taxEnabled} className="input-base font-mono disabled:bg-bg-subtle" value={defaultTaxRate} onChange={(event) => applyTaxRateToAll(Number(event.target.value))} />
                </div>
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="section-title mb-0">Renglones</p>
                <div className="flex gap-2">
                  {category === "brand_creation" && (
                    <button type="button" onClick={addBrandCreationLines} className="btn-secondary text-xs">
                      <Plus className="w-3.5 h-3.5" /> Crea tu Marca
                    </button>
                  )}
                  {category === "green_coffee" && (
                    <button type="button" onClick={addRoastServiceFromGreenLine} className="btn-secondary text-xs">
                      <Plus className="w-3.5 h-3.5" /> Servicio de tueste
                    </button>
                  )}
                  <button type="button" onClick={() => append(defaultItem)} className="btn-secondary text-xs">
                    <Plus className="w-3.5 h-3.5" /> Agregar
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {fields.map((field, index) => {
                  const item = watched.items?.[index];
                  return (
                    <div key={field.id} className="border border-border-default rounded-xl p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-secondary">Renglón {index + 1}</span>
                        {fields.length > 1 && (
                          <button type="button" onClick={() => remove(index)} className="text-status-danger hover:bg-red-50 p-1 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="label-base">Tomar precio sugerido</label>
                          <select className="input-base" value={item?.catalog_item_id ?? ""} onChange={(e) => applyCatalogItem(index, e.target.value)}>
                            <option value="">Sin precio sugerido</option>
                            {categoryCatalog.map((catalogItem) => (
                              <option key={catalogItem.id} value={catalogItem.id}>
                                {catalogItem.name} · {formatCurrency(catalogItem.suggested_unit_price, roaster?.currency)} / {catalogItem.unit_label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {category !== "machines" && (
                          <div className="col-span-2">
                            <label className="label-base">Café verde del stock</label>
                            <select className="input-base" value={item?.green_coffee_id ?? ""} onChange={(e) => applyGreenCoffee(index, e.target.value)}>
                              <option value="">Sin vincular</option>
                              {coffees.map((coffee) => <option key={coffee.id} value={coffee.id}>{coffee.name} · {coffee.current_stock_kg} kg</option>)}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="label-base">Tipo</label>
                          <select className="input-base" {...register(`items.${index}.item_kind`)}>
                            {(["green_coffee", "roast_service", "machine", "destoner", "other"] as QuoteItemKind[]).map((kind) => (
                              <option key={kind} value={kind}>{QUOTE_KIND_LABELS[kind]}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label-base">Unidad</label>
                          <input className="input-base" {...register(`items.${index}.unit_label`)} />
                        </div>
                        <div className="col-span-2">
                          <label className="label-base">Descripción</label>
                          <input className="input-base" {...register(`items.${index}.description`)} />
                          {errors.items?.[index]?.description && <p className="text-xs text-status-danger mt-1">{errors.items[index]?.description?.message}</p>}
                        </div>
                        <div>
                          <label className="label-base">Cantidad</label>
                          <input type="number" step="0.001" className="input-base font-mono" {...register(`items.${index}.quantity`)} />
                        </div>
                        <div>
                          <label className="label-base">Precio unitario</label>
                          <input type="number" step="0.01" className="input-base font-mono" {...register(`items.${index}.unit_price`)} />
                        </div>
                        <div>
                          <label className="label-base">IVA renglón</label>
                          <label className="flex items-center gap-2 h-10 px-3 rounded-lg border border-border-default cursor-pointer">
                            <input type="checkbox" className="accent-accent-green" {...register(`items.${index}.tax_enabled`)} />
                            <span className="text-sm">Incluir IVA</span>
                          </label>
                        </div>
                        <div>
                          <label className="label-base">Alícuota IVA (%)</label>
                          <input type="number" step="0.1" disabled={!item?.tax_enabled} className="input-base font-mono disabled:bg-bg-subtle" {...register(`items.${index}.tax_rate`)} />
                        </div>
                      </div>
                      <div className="text-right text-xs text-text-secondary">
                        {(() => {
                          const lineSubtotal = (Number(item?.quantity) || 0) * (Number(item?.unit_price) || 0);
                          const lineTax = item?.tax_enabled ? lineSubtotal * ((Number(item?.tax_rate) || 0) / 100) : 0;
                          return (
                            <>
                              Subtotal: <span className="font-mono font-medium text-text-primary">{formatCurrency(lineSubtotal, watch("currency"))}</span>
                              <span className="mx-2">·</span>
                              IVA: <span className="font-mono font-medium text-text-primary">{formatCurrency(lineTax, watch("currency"))}</span>
                              <span className="mx-2">·</span>
                              Total: <span className="font-mono font-semibold text-text-primary">{formatCurrency(lineSubtotal + lineTax, watch("currency"))}</span>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card p-6">
              <label className="label-base">Notas</label>
              <textarea className="input-base resize-none" rows={3} placeholder="Condiciones comerciales, entrega, vigencia, detalles técnicos..." {...register("notes")} />
            </div>

            <div className="flex gap-3">
              <Link href="/quotes" className="btn-secondary flex-1 justify-center">Cancelar</Link>
              <button type="submit" className="btn-primary flex-1 justify-center" disabled={isSubmitting}>
                {isSubmitting ? "Guardando..." : "Emitir cotización"}
              </button>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="card p-5 sticky top-6">
              <p className="text-sm font-semibold text-text-primary mb-4">Resumen</p>
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Número</span>
                  <span className="font-mono">{nextQuoteNumber(existingCount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Subtotal</span>
                  <span className="font-mono">{formatCurrency(totals.subtotal, watch("currency"))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">IVA {taxEnabled ? `${watch("tax_rate")}%` : "sin IVA"}</span>
                  <span className="font-mono">{formatCurrency(totals.taxAmount, watch("currency"))}</span>
                </div>
                <div className="border-t border-border-default pt-3 flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-mono font-bold text-text-primary">{formatCurrency(totals.total, watch("currency"))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
