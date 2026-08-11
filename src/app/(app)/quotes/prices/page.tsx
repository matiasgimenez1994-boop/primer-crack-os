"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import {
  QUOTE_CATEGORY_LABELS,
  QUOTE_KIND_LABELS,
  type QuoteCategory,
  type QuoteItemKind,
} from "@/lib/quotes";
import type { GreenCoffee, QuotePriceCatalogItem, Roaster } from "@/types";

const categories: QuoteCategory[] = ["green_coffee", "brand_creation", "machines"];
const kinds: QuoteItemKind[] = ["green_coffee", "roast_service", "machine", "destoner", "other"];

const machinePresets = [
  { name: "Tostadora 1 kg por lote", item_kind: "machine" as QuoteItemKind, unit_label: "unidad", machine_capacity_kg: 1 },
  { name: "Tostadora 2 kg por lote", item_kind: "machine" as QuoteItemKind, unit_label: "unidad", machine_capacity_kg: 2 },
  { name: "Tostadora 3 kg por lote", item_kind: "machine" as QuoteItemKind, unit_label: "unidad", machine_capacity_kg: 3 },
  { name: "Tostadora 6 kg por lote", item_kind: "machine" as QuoteItemKind, unit_label: "unidad", machine_capacity_kg: 6 },
  { name: "Tostadora 30 kg por lote", item_kind: "machine" as QuoteItemKind, unit_label: "unidad", machine_capacity_kg: 30 },
  { name: "Destoner opcional", item_kind: "destoner" as QuoteItemKind, unit_label: "unidad", machine_capacity_kg: null },
];

type FormState = {
  category: QuoteCategory;
  item_kind: QuoteItemKind;
  green_coffee_id: string;
  name: string;
  description: string;
  unit_label: string;
  suggested_unit_price: number;
  machine_capacity_kg: string;
};

const emptyForm: FormState = {
  category: "green_coffee",
  item_kind: "green_coffee",
  green_coffee_id: "",
  name: "",
  description: "",
  unit_label: "kg",
  suggested_unit_price: 0,
  machine_capacity_kg: "",
};

export default function QuotePricesPage() {
  const supabase = createClient();
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [items, setItems] = useState<QuotePriceCatalogItem[]>([]);
  const [coffees, setCoffees] = useState<GreenCoffee[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: r } = await supabase.from("roasters").select("*").eq("user_id", user.id).single();
    if (!r) return;
    setRoaster(r);

    const [{ data: catalog }, { data: green }] = await Promise.all([
      supabase
        .from("quote_price_catalog")
        .select("*, green_coffees(name)")
        .eq("roaster_id", r.id)
        .order("category")
        .order("sort_order")
        .order("name"),
      supabase
        .from("green_coffees")
        .select("*")
        .eq("roaster_id", r.id)
        .neq("status", "depleted")
        .order("name"),
    ]);

    setItems(catalog ?? []);
    setCoffees(green ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveItem() {
    if (!roaster) return;
    if (!form.name.trim()) {
      toast.error("Ingresá un nombre para el precio sugerido");
      return;
    }

    const { error } = await supabase.from("quote_price_catalog").insert({
      roaster_id: roaster.id,
      category: form.category,
      item_kind: form.item_kind,
      green_coffee_id: form.item_kind === "green_coffee" && form.green_coffee_id ? form.green_coffee_id : null,
      name: form.name.trim(),
      description: form.description.trim() || null,
      unit_label: form.unit_label.trim() || "unidad",
      suggested_unit_price: Number(form.suggested_unit_price) || 0,
      machine_capacity_kg: form.machine_capacity_kg ? Number(form.machine_capacity_kg) : null,
      active: true,
    });

    if (error) {
      toast.error("Error al guardar el precio sugerido");
      return;
    }

    toast.success("Precio sugerido guardado");
    setForm(emptyForm);
    load();
  }

  async function addMachinePresets() {
    if (!roaster) return;
    const rows = machinePresets.map((preset, index) => ({
      roaster_id: roaster.id,
      category: "machines",
      suggested_unit_price: 0,
      active: true,
      sort_order: index,
      ...preset,
    }));

    const { error } = await supabase.from("quote_price_catalog").insert(rows);
    if (error) {
      toast.error("Error al cargar el catálogo de referencia");
      return;
    }
    toast.success("Catálogo de tostadoras agregado");
    load();
  }

  async function toggleActive(item: QuotePriceCatalogItem) {
    await supabase.from("quote_price_catalog").update({ active: !item.active }).eq("id", item.id);
    load();
  }

  async function deleteItem(itemId: string) {
    if (!confirm("¿Eliminar este precio sugerido? Las cotizaciones ya emitidas no se modifican.")) return;
    const { error } = await supabase.from("quote_price_catalog").delete().eq("id", itemId);
    if (error) {
      toast.error("Error al eliminar");
      return;
    }
    toast.success("Precio sugerido eliminado");
    load();
  }

  const hasMachineCatalog = items.some((item) => item.category === "machines");

  if (loading) return <p className="text-sm text-text-secondary">Cargando precios...</p>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/quotes" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="page-title">Precios sugeridos</h1>
            <p className="text-sm text-text-secondary">Valores base para nuevas cotizaciones. Cada cotización puede modificarlos sin cambiar esta lista.</p>
          </div>
        </div>
        {!hasMachineCatalog && (
          <button type="button" onClick={addMachinePresets} className="btn-secondary">
            <Plus className="w-4 h-4" /> Cargar tostadoras base
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-6">
            <p className="section-title">Nuevo precio sugerido</p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label-base">Categoría</label>
                <select className="input-base" value={form.category} onChange={(e) => updateForm("category", e.target.value as QuoteCategory)}>
                  {categories.map((category) => <option key={category} value={category}>{QUOTE_CATEGORY_LABELS[category]}</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">Tipo</label>
                <select className="input-base" value={form.item_kind} onChange={(e) => updateForm("item_kind", e.target.value as QuoteItemKind)}>
                  {kinds.map((kind) => <option key={kind} value={kind}>{QUOTE_KIND_LABELS[kind]}</option>)}
                </select>
              </div>
              {form.item_kind === "green_coffee" && (
                <div>
                  <label className="label-base">Café verde vinculado</label>
                  <select className="input-base" value={form.green_coffee_id} onChange={(e) => {
                    const coffee = coffees.find((c) => c.id === e.target.value);
                    updateForm("green_coffee_id", e.target.value);
                    if (coffee && !form.name) updateForm("name", coffee.name);
                  }}>
                    <option value="">Sin vincular</option>
                    {coffees.map((coffee) => <option key={coffee.id} value={coffee.id}>{coffee.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label-base">Nombre</label>
                <input className="input-base" value={form.name} onChange={(e) => updateForm("name", e.target.value)} placeholder="Ej: Servicio de tueste" />
              </div>
              <div>
                <label className="label-base">Descripción</label>
                <input className="input-base" value={form.description} onChange={(e) => updateForm("description", e.target.value)} placeholder="Detalle opcional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-base">Unidad</label>
                  <input className="input-base" value={form.unit_label} onChange={(e) => updateForm("unit_label", e.target.value)} placeholder="kg, unidad, servicio" />
                </div>
                <div>
                  <label className="label-base">Precio sugerido</label>
                  <input type="number" step="0.01" className="input-base font-mono" value={form.suggested_unit_price} onChange={(e) => updateForm("suggested_unit_price", Number(e.target.value))} />
                </div>
              </div>
              {form.item_kind === "machine" && (
                <div>
                  <label className="label-base">Capacidad por lote (kg)</label>
                  <input type="number" step="0.1" className="input-base font-mono" value={form.machine_capacity_kg} onChange={(e) => updateForm("machine_capacity_kg", e.target.value)} />
                </div>
              )}
              <button type="button" onClick={saveItem} className="btn-primary w-full mt-2">
                <Save className="w-4 h-4" /> Guardar precio
              </button>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-[#F8FAFC]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Nombre</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden md:table-cell">Categoría</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary hidden lg:table-cell">Tipo</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Precio</th>
                  <th className="px-3 py-3 w-16" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={`border-b border-border-default last:border-0 ${!item.active ? "bg-gray-50 text-text-secondary" : ""}`}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-text-primary">{item.name}</p>
                      <p className="text-xs text-text-secondary">{item.description || item.unit_label}</p>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">{QUOTE_CATEGORY_LABELS[item.category]}</td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">{QUOTE_KIND_LABELS[item.item_kind]}</td>
                    <td className="px-5 py-3.5 text-right font-mono">
                      {formatCurrency(item.suggested_unit_price, roaster?.currency)} / {item.unit_label}
                    </td>
                    <td className="px-3 py-3.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => toggleActive(item)} className="btn-ghost px-2 py-1 text-xs">
                          {item.active ? "Pausar" : "Activar"}
                        </button>
                        <button type="button" onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg text-text-secondary hover:text-status-danger hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-text-secondary">
                      Todavía no hay precios sugeridos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
