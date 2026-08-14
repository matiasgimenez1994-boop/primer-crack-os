"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { formatCurrency, todayISO } from "@/lib/utils";
import type { Client, GreenCoffee, RoastBatch, Roaster } from "@/types";

type DocumentType = "draft" | "proforma" | "boleta";
type ProductType = "roasted" | "green" | "service";
type PaymentCurrency = "USD" | "UYU";

interface BatchOption {
  batch: RoastBatch & { green_coffees?: GreenCoffee; current_stock_kg?: number };
  remainingKg: number;
}

interface SaleItemForm {
  id: string;
  product_type: ProductType;
  roast_batch_id: string;
  weight_grams: number;
  green_coffee_id: string;
  green_weight_kg: number;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  notes: string;
}

const weightOptions = [
  { value: 250, label: "250 g" },
  { value: 500, label: "500 g" },
  { value: 1000, label: "1 kg" },
];

function makeItem(productType: ProductType = "green"): SaleItemForm {
  return {
    id: crypto.randomUUID(),
    product_type: productType,
    roast_batch_id: "",
    weight_grams: 250,
    green_coffee_id: "",
    green_weight_kg: productType === "service" ? 0 : 1,
    quantity: 1,
    unit_price: productType === "service" ? 5 : 0,
    tax_rate: 19,
    notes: productType === "service" ? "Servicio de tueste" : "",
  };
}

function money(value: number) {
  return Math.round(value * 100) / 100;
}

function isStockCommitError(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("stock") || normalized.includes("inventario");
}

function roastedSelectionValue(item: SaleItemForm) {
  if (item.roast_batch_id) return `batch:${item.roast_batch_id}`;
  if (item.green_coffee_id) return `green:${item.green_coffee_id}`;
  return "";
}

export default function NewSalePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [greenCoffees, setGreenCoffees] = useState<GreenCoffee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [orderDate, setOrderDate] = useState(todayISO());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("boleta");
  const [defaultTaxRate, setDefaultTaxRate] = useState(19);
  const [notes, setNotes] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "transfer" | "credit">("cash");
  const [paymentStatus, setPaymentStatus] = useState<"paid" | "pending" | "partial">("paid");
  const [paymentCurrency, setPaymentCurrency] = useState<PaymentCurrency>((roaster?.currency === "UYU" ? "UYU" : "USD") as PaymentCurrency);
  const [amountPaid, setAmountPaid] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<SaleItemForm[]>([makeItem("green")]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("roasters").select("*").eq("user_id", user.id).single().then(({ data: r }) => {
        if (!r) return;
        setRoaster(r);
        setPaymentCurrency((r.currency === "UYU" ? "UYU" : "USD") as PaymentCurrency);
        loadBatches(r.id);
        supabase.from("green_coffees").select("*").eq("roaster_id", r.id).neq("status", "depleted").order("name").then(({ data }) => setGreenCoffees(data ?? []));
        supabase.from("clients").select("*").eq("roaster_id", r.id).order("name").then(({ data }) => setClients(data ?? []));
      });
    });
  }, [supabase]);

  async function loadBatches(roasterId: string) {
    const { data } = await supabase
      .from("roast_batches")
      .select("*, green_coffees(*)")
      .eq("roaster_id", roasterId)
      .eq("status", "production")
      .order("roast_date", { ascending: false });

    setBatchOptions((data ?? []).map((batch: any) => ({
      batch,
      remainingKg: Number(batch.current_stock_kg ?? batch.roasted_weight_kg ?? 0),
    })).filter((option) => option.remainingKg > 0));
  }

  function updateItem(id: string, patch: Partial<SaleItemForm>) {
    setItems((current) => current.map((item) => {
      if (item.id !== id) return item;
      const next = { ...item, ...patch };
      if (patch.product_type === "green") {
        next.roast_batch_id = "";
        next.weight_grams = 250;
        next.quantity = 1;
      }
      if (patch.product_type === "roasted") {
        next.green_coffee_id = "";
        next.green_weight_kg = 1;
      }
      if (patch.product_type === "service") {
        next.roast_batch_id = "";
        next.green_coffee_id = "";
        next.green_weight_kg = 0;
        next.weight_grams = 0;
        next.notes = next.notes || "Servicio de tueste";
      }
      return next;
    }));
  }

  function applyTaxRate(value: number) {
    setDefaultTaxRate(value);
    setItems((current) => current.map((item) => ({ ...item, tax_rate: value })));
  }

  function addItem(productType: ProductType) {
    setItems((current) => {
      const item = { ...makeItem(productType), tax_rate: defaultTaxRate };
      if (productType === "service") {
        const greenKg = current
          .filter((entry) => entry.product_type === "green")
          .reduce((sum, entry) => sum + Number(entry.green_weight_kg || 0), 0);
        item.quantity = greenKg > 0 ? money(greenKg) : 1;
      }
      return [...current, item];
    });
  }

  function removeItem(id: string) {
    setItems((current) => current.length === 1 ? current : current.filter((item) => item.id !== id));
  }

  function updateRoastedSelection(id: string, value: string) {
    if (value.startsWith("batch:")) {
      updateItem(id, { roast_batch_id: value.slice(6), green_coffee_id: "" });
      return;
    }
    if (value.startsWith("green:")) {
      updateItem(id, { roast_batch_id: "", green_coffee_id: value.slice(6) });
      return;
    }
    updateItem(id, { roast_batch_id: "", green_coffee_id: "" });
  }

  function lineSubtotal(item: SaleItemForm) {
    if (item.product_type === "green") return Number(item.green_weight_kg || 0) * Number(item.unit_price || 0);
    if (item.product_type === "service") return Number(item.quantity || 0) * Number(item.unit_price || 0);
    return Number(item.quantity || 0) * Number(item.unit_price || 0);
  }

  function lineTax(item: SaleItemForm) {
    return money(lineSubtotal(item) * Number(item.tax_rate || 0) / 100);
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + lineSubtotal(item), 0);
    const tax = items.reduce((sum, item) => sum + lineTax(item), 0);
    return { subtotal: money(subtotal), tax: money(tax), total: money(subtotal + tax) };
  }, [items]);

  function validateItems() {
    if (items.length === 0) return "Agrega al menos un producto";
    for (const item of items) {
      if (item.product_type === "green") {
        const coffee = greenCoffees.find((c) => c.id === item.green_coffee_id);
        if (!coffee) return "Selecciona el cafe verde en todos los items";
        if (Number(item.green_weight_kg) <= 0) return "La cantidad de cafe verde debe ser mayor a 0";
        if (Number(item.green_weight_kg) > Number(coffee.current_stock_kg)) return `${coffee.name} no tiene stock suficiente de cafe verde`;
      } else if (item.product_type === "roasted") {
        const option = batchOptions.find((b) => b.batch.id === item.roast_batch_id);
        const coffee = greenCoffees.find((c) => c.id === item.green_coffee_id);
        if (!option && !coffee) return "Selecciona un lote tostado o un cafe verde para producir";
        const requestedKg = Number(item.weight_grams || 0) * Number(item.quantity || 0) / 1000;
        if (requestedKg <= 0) return "La cantidad tostada debe ser mayor a 0";
      } else {
        if (Number(item.quantity) <= 0) return "La cantidad del servicio debe ser mayor a 0";
      }
      if (Number(item.unit_price) <= 0) return "Todos los items necesitan precio";
    }
    return null;
  }

  function roastedStockShortages() {
    const grouped = new Map<string, { name: string; requestedKg: number; availableKg: number }>();

    items
      .filter((item) => item.product_type === "roasted")
      .forEach((item) => {
        const option = batchOptions.find((entry) => entry.batch.id === item.roast_batch_id);
        const coffee = greenCoffees.find((entry) => entry.id === item.green_coffee_id);
        const key = item.roast_batch_id ? `batch:${item.roast_batch_id}` : item.green_coffee_id ? `green:${item.green_coffee_id}` : item.id;
        const requestedKg = Number(item.weight_grams || 0) * Number(item.quantity || 0) / 1000;
        const current = grouped.get(key) ?? {
          name: option?.batch.green_coffees?.name ?? coffee?.name ?? "Cafe tostado",
          requestedKg: 0,
          availableKg: Number(option?.remainingKg ?? 0),
        };

        current.requestedKg += requestedKg;
        grouped.set(key, current);
      });

    return Array.from(grouped.values())
      .map((entry) => ({
        ...entry,
        shortageKg: Math.max(0, entry.requestedKg - entry.availableKg),
      }))
      .filter((entry) => entry.shortageKg > 0);
  }

  async function onSubmit() {
    if (!roaster || isSubmitting) return;
    const validationError = validateItems();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsSubmitting(true);
    const selectedClient = clients.find((client) => client.id === clientId);
    const status = documentType === "boleta" ? "pending" : documentType;

    const { data: order, error: orderError } = await supabase.from("orders").insert({
      roaster_id: roaster.id,
      client_id: clientId || null,
      client_name: selectedClient?.name ?? null,
      order_date: orderDate,
      delivery_date: deliveryDate || null,
      status,
      document_type: documentType,
      tax_rate: defaultTaxRate,
      subtotal_amount: totals.subtotal,
      tax_amount: totals.tax,
      total_amount: totals.total,
      payment_type: paymentType,
      payment_status: paymentStatus,
      payment_currency: paymentCurrency,
      amount_paid: paymentStatus === "pending" ? 0 : amountPaid > 0 ? amountPaid : totals.total,
      due_date: paymentStatus === "paid" ? null : dueDate || null,
      paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
      notes: notes || null,
    }).select("id").single();

    if (orderError || !order) {
      toast.error("Error al crear la venta");
      setIsSubmitting(false);
      return;
    }

    const rows = items.map((item) => {
      const subtotal = money(lineSubtotal(item));
      const tax = lineTax(item);
      return {
        order_id: order.id,
        product_type: item.product_type,
        roast_batch_id: item.product_type === "roasted" && item.roast_batch_id ? item.roast_batch_id : null,
        green_coffee_id: item.product_type === "green" ? item.green_coffee_id : item.product_type === "roasted" ? (batchOptions.find((option) => option.batch.id === item.roast_batch_id)?.batch.green_coffee_id ?? item.green_coffee_id) || null : null,
        weight_grams: item.product_type === "roasted" ? item.weight_grams : null,
        green_weight_kg: item.product_type === "green" ? item.green_weight_kg : null,
        quantity: item.product_type === "green" ? 1 : item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: money(subtotal + tax),
        notes: item.notes || null,
      };
    });

    const { error: itemsError } = await supabase.from("order_items").insert(rows);
    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      toast.error("Error al guardar los productos de la venta");
      setIsSubmitting(false);
      return;
    }

    const shortages = roastedStockShortages();
    const hasRoastedItems = items.some((item) => item.product_type === "roasted");
    const hasServiceItems = items.some((item) => item.product_type === "service");
    const canCommitInventoryImmediately = documentType === "boleta"
      && shortages.length === 0
      && !hasRoastedItems
      && !hasServiceItems;

    if (canCommitInventoryImmediately) {
      const { error: confirmError } = await supabase.rpc("confirm_order_and_commit_inventory", { p_order_id: order.id });
      if (confirmError) {
        if (isStockCommitError(confirmError.message || "")) {
          toast.warning("Venta guardada. No hay stock suficiente; queda pendiente para planificar tueste.");
          router.push("/sales");
          router.refresh();
          return;
        } else {
          toast.error(confirmError.message || "La venta quedo creada, pero no se pudo confirmar inventario");
          setIsSubmitting(false);
          return;
        }
      }
    }

    if (shortages.length > 0) {
      const totalShortageKg = shortages.reduce((sum, entry) => sum + entry.shortageKg, 0);
      toast.warning(`Venta guardada. Falta tostar ${totalShortageKg.toFixed(2)} kg de cafe tostado.`);
    } else if (documentType === "boleta" && hasRoastedItems) {
      toast.success("Venta guardada. El inventario tostado queda para confirmar desde planificacion.");
    } else if (documentType === "boleta" && hasServiceItems) {
      toast.success("Venta guardada. El servicio no descuenta inventario.");
    } else {
      toast.success(documentType === "boleta" ? "Venta confirmada" : "Venta guardada");
    }
    router.push("/sales");
    router.refresh();
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="page-title">Registrar venta</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="card p-6">
            <p className="section-title">Documento y pago</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="label-base">Tipo</label>
                <select className="input-base" value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>
                  <option value="draft">Borrador</option>
                  <option value="proforma">Proforma</option>
                  <option value="boleta">Boleta confirmada</option>
                </select>
                <p className="text-xs text-text-secondary mt-1">Solo la boleta confirmada descuenta inventario.</p>
              </div>
              <div><label className="label-base">Fecha</label><input type="date" className="input-base" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} /></div>
              <div><label className="label-base">IVA general</label><input type="number" step="0.01" min="0" className="input-base font-mono" value={defaultTaxRate} onChange={(event) => applyTaxRate(Number(event.target.value))} /></div>
              <div>
                <label className="label-base">Cliente</label>
                <select className="input-base" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  <option value="">Sin cliente asignado</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div><label className="label-base">Entrega</label><input type="date" className="input-base" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></div>
              <div>
                <label className="label-base">Estado de pago</label>
                <select className="input-base" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as "paid" | "pending" | "partial")}>
                  <option value="paid">Pagado</option>
                  <option value="pending">Pendiente de pago</option>
                  <option value="partial">Pago parcial</option>
                </select>
              </div>
              <div>
                <label className="label-base">Medio de pago</label>
                <select className="input-base" value={paymentType} onChange={(event) => setPaymentType(event.target.value as "cash" | "transfer" | "credit")}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="credit">Credito</option>
                </select>
              </div>
              <div>
                <label className="label-base">Moneda de la venta</label>
                <select className="input-base" value={paymentCurrency} onChange={(event) => setPaymentCurrency(event.target.value as PaymentCurrency)}>
                  <option value="USD">Dolares (USD)</option>
                  <option value="UYU">Pesos uruguayos (UYU)</option>
                </select>
              </div>
              {paymentStatus !== "pending" && <div><label className="label-base">Monto cobrado</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value))} placeholder={String(totals.total)} /><p className="text-xs text-text-secondary mt-1">{formatCurrency(amountPaid || totals.total, paymentCurrency)}</p></div>}
              {paymentStatus !== "paid" && <div><label className="label-base">Vencimiento pago</label><input type="date" className="input-base" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div>}
              <div><label className="label-base">Notas</label><input className="input-base" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones..." /></div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <p className="section-title mb-0">Productos</p>
              <div className="flex flex-wrap gap-2">

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary uppercase">Moneda</span>
                  <select id="sale-currency-products" className="input-base w-28" value={paymentCurrency} onChange={(event) => setPaymentCurrency(event.target.value as PaymentCurrency)}>
                    <option value="USD">USD</option>
                    <option value="UYU">UYU</option>
                  </select>
                </div>
                <button type="button" className="btn-secondary" onClick={() => addItem("green")}><Plus className="w-4 h-4" /> Cafe verde</button>
                <button type="button" className="btn-secondary" onClick={() => addItem("roasted")}><Plus className="w-4 h-4" /> Cafe tostado</button>
                <button type="button" className="btn-secondary" onClick={() => addItem("service")}><Plus className="w-4 h-4" /> Servicio tueste</button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {items.map((item, index) => {
                const selectedGreen = greenCoffees.find((coffee) => coffee.id === item.green_coffee_id);
                const selectedBatch = batchOptions.find((option) => option.batch.id === item.roast_batch_id);
                const subtotal = lineSubtotal(item);
                const tax = lineTax(item);
                return (
                  <div key={item.id} className="border border-border-default rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <p className="text-sm font-semibold text-text-primary">Item {index + 1}</p>
                      <button type="button" className="btn-ghost p-2 text-status-danger" onClick={() => removeItem(item.id)} disabled={items.length === 1} title="Eliminar item"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label-base">Tipo</label>
                        <select className="input-base" value={item.product_type} onChange={(event) => updateItem(item.id, { product_type: event.target.value as ProductType })}>
                          <option value="green">Cafe verde</option>
                          <option value="roasted">Cafe tostado</option>
                          <option value="service">Servicio de tueste</option>
                        </select>
                      </div>

                      {item.product_type === "service" ? (
                        <>
                          <div><label className="label-base">Descripcion</label><input className="input-base" value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder="Servicio de tueste" /></div>
                          <div><label className="label-base">Kg servicio</label><input type="number" min="0" step="0.001" className="input-base font-mono" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} /></div>
                          <div><label className="label-base">Precio por kg ({paymentCurrency})</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={item.unit_price} onChange={(event) => updateItem(item.id, { unit_price: Number(event.target.value) })} /></div>
                        </>
                      ) : item.product_type === "green" ? (
                        <>
                          <div>
                            <label className="label-base">Cafe verde</label>
                            <select className="input-base" value={item.green_coffee_id} onChange={(event) => {
                              const coffee = greenCoffees.find((c) => c.id === event.target.value);
                              updateItem(item.id, { green_coffee_id: event.target.value, unit_price: coffee ? money(coffee.purchase_price_per_kg * 1.3) : item.unit_price });
                            }}>
                              <option value="">Seleccionar cafe...</option>
                              {greenCoffees.map((coffee) => <option key={coffee.id} value={coffee.id}>{coffee.name} - {coffee.current_stock_kg.toFixed(2)} kg</option>)}
                            </select>
                            {selectedGreen && <p className="text-xs text-text-secondary mt-1">Stock: {selectedGreen.current_stock_kg.toFixed(3)} kg</p>}
                          </div>
                          <div><label className="label-base">Kg</label><input type="number" min="0" step="0.001" className="input-base font-mono" value={item.green_weight_kg} onChange={(event) => updateItem(item.id, { green_weight_kg: Number(event.target.value) })} /></div>
                          <div><label className="label-base">Precio por kg ({paymentCurrency})</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={item.unit_price} onChange={(event) => updateItem(item.id, { unit_price: Number(event.target.value) })} /></div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="label-base">Cafe tostado o para producir</label>
                            <select className="input-base" value={roastedSelectionValue(item)} onChange={(event) => updateRoastedSelection(item.id, event.target.value)}>
                              <option value="">Seleccionar cafe...</option>
                              <optgroup label="Lotes tostados disponibles">
                                {batchOptions.map(({ batch, remainingKg }) => <option key={batch.id} value={`batch:${batch.id}`}>{batch.green_coffees?.name} - {new Date(batch.roast_date).toLocaleDateString("es-UY")} - {remainingKg.toFixed(2)} kg</option>)}
                              </optgroup>
                              <optgroup label="Cafe verde para tostar">
                                {greenCoffees.map((coffee) => <option key={coffee.id} value={`green:${coffee.id}`}>{coffee.name} - verde {coffee.current_stock_kg.toFixed(2)} kg</option>)}
                              </optgroup>
                            </select>
                            {selectedBatch && <p className="text-xs text-text-secondary mt-1">Stock: {selectedBatch.remainingKg.toFixed(3)} kg</p>}
                            {!selectedBatch && item.green_coffee_id && <p className="text-xs text-orange-700 mt-1">Sin lote tostado: se guarda como pendiente para planificar tueste.</p>}
                          </div>
                          <div><label className="label-base">Presentacion</label><select className="input-base" value={item.weight_grams} onChange={(event) => updateItem(item.id, { weight_grams: Number(event.target.value) })}>{weightOptions.map((weight) => <option key={weight.value} value={weight.value}>{weight.label}</option>)}</select></div>
                          <div><label className="label-base">Cantidad</label><input type="number" min="1" step="1" className="input-base font-mono" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} /></div>
                          <div><label className="label-base">Precio unitario ({paymentCurrency})</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={item.unit_price} onChange={(event) => updateItem(item.id, { unit_price: Number(event.target.value) })} /></div>
                        </>
                      )}

                      <div><label className="label-base">IVA item</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={item.tax_rate} onChange={(event) => updateItem(item.id, { tax_rate: Number(event.target.value) })} /></div>
                      {item.product_type !== "service" && <div><label className="label-base">Notas item</label><input className="input-base" value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} placeholder="Opcional" /></div>}
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs bg-[#F8FAFC] rounded-lg p-3">
                      <div><p className="text-text-secondary">Subtotal</p><p className="font-mono font-medium">{formatCurrency(subtotal, paymentCurrency)}</p></div>
                      <div><p className="text-text-secondary">IVA</p><p className="font-mono font-medium">{formatCurrency(tax, paymentCurrency)}</p></div>
                      <div><p className="text-text-secondary">Total</p><p className="font-mono font-semibold text-text-primary">{formatCurrency(subtotal + tax, paymentCurrency)}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/sales" className="btn-secondary flex-1 justify-center">Cancelar</Link>
            <button type="button" className="btn-primary flex-1 justify-center" disabled={isSubmitting} onClick={onSubmit}>{isSubmitting ? "Guardando..." : documentType === "boleta" ? "Confirmar boleta" : "Guardar"}</button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-4"><ShoppingBag className="w-4 h-4 text-accent-green" /><p className="text-sm font-semibold text-text-primary">Resumen</p></div>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between text-xs"><span className="text-text-secondary">Items</span><span className="font-mono">{items.length}</span></div>
              <div className="flex justify-between text-xs"><span className="text-text-secondary">Subtotal</span><span className="font-mono">{formatCurrency(totals.subtotal, paymentCurrency)}</span></div>
              <div className="flex justify-between text-xs"><span className="text-text-secondary">IVA</span><span className="font-mono">{formatCurrency(totals.tax, paymentCurrency)}</span></div>
              <div className="border-t border-border-default pt-3 flex justify-between"><span className="text-sm font-semibold">Total</span><span className="text-sm font-mono font-bold text-text-primary">{formatCurrency(totals.total, paymentCurrency)}</span></div>
              <div className="rounded-lg bg-[#F8FAFC] p-3 text-xs text-text-secondary">{documentType === "boleta" ? "Al confirmar se descuenta inventario y se crea el movimiento de stock." : "Borradores y proformas no descuentan inventario."}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
