"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import type { Client, GreenCoffee, Order, RoastBatch, Roaster } from "@/types";

type DocumentType = "draft" | "proforma" | "boleta";
type ProductType = "green" | "roasted";
type PaymentType = "cash" | "transfer" | "credit";
type PaymentStatus = "paid" | "pending" | "partial";

interface BatchOption {
  batch: RoastBatch & { green_coffees?: GreenCoffee; current_stock_kg?: number };
  remainingKg: number;
}

interface EditableItem {
  id: string;
  product_type: ProductType;
  green_coffee_id: string;
  roast_batch_id: string;
  weight_grams: number;
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

function makeItem(productType: ProductType = "green"): EditableItem {
  return {
    id: crypto.randomUUID(),
    product_type: productType,
    green_coffee_id: "",
    roast_batch_id: "",
    weight_grams: 250,
    green_weight_kg: 1,
    quantity: 1,
    unit_price: 0,
    tax_rate: 19,
    notes: "",
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export default function EditSalePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [roaster, setRoaster] = useState<Roaster | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [greenCoffees, setGreenCoffees] = useState<GreenCoffee[]>([]);
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([]);
  const [order, setOrder] = useState<Order | null>(null);
  const [clientId, setClientId] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [documentType, setDocumentType] = useState<DocumentType>("boleta");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<EditableItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: r } = await supabase.from("roasters").select("*").eq("user_id", user.id).single();
      if (!r) return;
      setRoaster(r);

      const [{ data: clientsData }, { data: coffeesData }, { data: batchesData }, { data: orderData }] = await Promise.all([
        supabase.from("clients").select("*").eq("roaster_id", r.id).order("name"),
        supabase.from("green_coffees").select("*").eq("roaster_id", r.id).order("name"),
        supabase.from("roast_batches").select("*, green_coffees(*)").eq("roaster_id", r.id).eq("status", "production").order("roast_date", { ascending: false }),
        supabase
          .from("orders")
          .select("*, clients(name), order_items(*, green_coffees(name), roast_batches(roast_date, green_coffees(name)))")
          .eq("id", id)
          .eq("roaster_id", r.id)
          .single(),
      ]);

      setClients(clientsData ?? []);
      setGreenCoffees(coffeesData ?? []);
      setBatchOptions((batchesData ?? []).map((batch: any) => ({
        batch,
        remainingKg: Number(batch.current_stock_kg ?? batch.roasted_weight_kg ?? 0),
      })).filter((option) => option.remainingKg > 0));

      if (orderData) {
        setOrder(orderData as Order);
        setClientId(orderData.client_id ?? "");
        setOrderDate(orderData.order_date ?? "");
        setDeliveryDate(orderData.delivery_date ?? "");
        setDocumentType((orderData.document_type ?? "boleta") as DocumentType);
        setPaymentType(((orderData as any).payment_type ?? "cash") as PaymentType);
        setPaymentStatus(((orderData as any).payment_status ?? "paid") as PaymentStatus);
        setAmountPaid(Number((orderData as any).amount_paid ?? orderData.total_amount ?? 0));
        setDueDate((orderData as any).due_date ?? "");
        setNotes(orderData.notes ?? "");
        setItems(((orderData as any).order_items ?? []).map((item: any) => ({
          id: item.id,
          product_type: item.product_type,
          green_coffee_id: item.green_coffee_id ?? "",
          roast_batch_id: item.roast_batch_id ?? "",
          weight_grams: Number(item.weight_grams ?? 250),
          green_weight_kg: Number(item.green_weight_kg ?? 1),
          quantity: Number(item.quantity ?? 1),
          unit_price: Number(item.unit_price ?? 0),
          tax_rate: Number(item.tax_rate ?? orderData.tax_rate ?? 19),
          notes: item.notes ?? "",
        })));
      }

      setLoading(false);
    }

    load();
  }, [id, supabase]);

  function itemSubtotal(item: EditableItem) {
    if (item.product_type === "green") return Number(item.green_weight_kg || 0) * Number(item.unit_price || 0);
    return Number(item.quantity || 0) * Number(item.unit_price || 0);
  }

  function itemTax(item: EditableItem) {
    return roundMoney(itemSubtotal(item) * Number(item.tax_rate || 0) / 100);
  }

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + itemSubtotal(item), 0);
    const tax = items.reduce((sum, item) => sum + itemTax(item), 0);
    return { subtotal: roundMoney(subtotal), tax: roundMoney(tax), total: roundMoney(subtotal + tax) };
  }, [items]);

  function updateItem(itemId: string, patch: Partial<EditableItem>) {
    setItems((current) => current.map((item) => {
      if (item.id !== itemId) return item;
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
      return next;
    }));
  }

  function addItem(productType: ProductType) {
    setItems((current) => [...current, makeItem(productType)]);
  }

  function removeItem(itemId: string) {
    setItems((current) => current.length === 1 ? current : current.filter((item) => item.id !== itemId));
  }

  function itemLabel(item: EditableItem) {
    if (item.product_type === "green") {
      const coffee = greenCoffees.find((entry) => entry.id === item.green_coffee_id);
      return (coffee?.name ?? "Cafe verde") + " - " + Number(item.green_weight_kg || 0).toFixed(3) + " kg";
    }
    const option = batchOptions.find((entry) => entry.batch.id === item.roast_batch_id);
    return (option?.batch.green_coffees?.name ?? "Cafe tostado") + " - " + item.weight_grams + " g x " + item.quantity;
  }

  function validateItems() {
    if (items.length === 0) return "Agrega al menos un producto";
    for (const item of items) {
      if (item.product_type === "green") {
        if (!item.green_coffee_id) return "Selecciona el cafe verde en todos los items";
        if (Number(item.green_weight_kg) <= 0) return "La cantidad de cafe verde debe ser mayor a 0";
      } else {
        if (!item.roast_batch_id) return "Selecciona el lote tostado en todos los items tostados";
        if (Number(item.quantity) <= 0) return "La cantidad debe ser mayor a 0";
      }
      if (Number(item.unit_price) < 0) return "El precio no puede ser negativo";
    }
    return null;
  }

  async function reverseCommittedInventory() {
    if (!order?.inventory_committed_at) return true;

    const { data: movements, error } = await supabase
      .from("inventory_movements")
      .select("*")
      .eq("order_id", order.id);

    if (error) {
      toast.error("No se pudieron leer los movimientos de inventario");
      return false;
    }

    for (const movement of movements ?? []) {
      const restoreKg = -Number((movement as any).quantity_kg ?? 0);
      if (restoreKg <= 0) continue;

      if ((movement as any).product_type === "green" && (movement as any).green_coffee_id) {
        const { data: coffee } = await supabase.from("green_coffees").select("current_stock_kg, status").eq("id", (movement as any).green_coffee_id).single();
        if (coffee) {
          await supabase.from("green_coffees").update({
            current_stock_kg: Number(coffee.current_stock_kg ?? 0) + restoreKg,
            status: coffee.status === "depleted" ? "active" : coffee.status,
          }).eq("id", (movement as any).green_coffee_id);
        }
      }

      if ((movement as any).product_type === "roasted" && (movement as any).roast_batch_id) {
        const { data: batch } = await supabase.from("roast_batches").select("current_stock_kg").eq("id", (movement as any).roast_batch_id).single();
        if (batch) {
          await supabase.from("roast_batches").update({
            current_stock_kg: Number(batch.current_stock_kg ?? 0) + restoreKg,
          }).eq("id", (movement as any).roast_batch_id);
        }
      }
    }

    await supabase.from("inventory_movements").delete().eq("order_id", order.id);
    await supabase.from("orders").update({ inventory_committed_at: null, confirmed_at: null }).eq("id", order.id);
    return true;
  }

  async function save() {
    if (!order || saving) return;

    const validationError = validateItems();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSaving(true);

    const reversed = await reverseCommittedInventory();
    if (!reversed) {
      setSaving(false);
      return;
    }

    await supabase.from("order_items").delete().eq("order_id", order.id);

    const newRows = items.map((item) => {
      const subtotal = roundMoney(itemSubtotal(item));
      const tax = itemTax(item);
      return {
        order_id: order.id,
        product_type: item.product_type,
        green_coffee_id: item.product_type === "green"
          ? item.green_coffee_id
          : batchOptions.find((option) => option.batch.id === item.roast_batch_id)?.batch.green_coffee_id ?? null,
        roast_batch_id: item.product_type === "roasted" ? item.roast_batch_id : null,
        weight_grams: item.product_type === "roasted" ? item.weight_grams : null,
        green_weight_kg: item.product_type === "green" ? item.green_weight_kg : null,
        quantity: item.product_type === "green" ? 1 : item.quantity,
        unit_price: item.unit_price,
        tax_rate: item.tax_rate,
        subtotal_amount: subtotal,
        tax_amount: tax,
        total_amount: roundMoney(subtotal + tax),
        notes: item.notes || null,
      };
    });

    const { error: itemsError } = await supabase.from("order_items").insert(newRows);
    if (itemsError) {
      toast.error("No se pudieron guardar los productos");
      setSaving(false);
      return;
    }

    const selectedClient = clients.find((client) => client.id === clientId);
    const shouldConfirm = documentType === "boleta";
    const paidAmount = paymentStatus === "paid" ? totals.total : paymentStatus === "pending" ? 0 : amountPaid;

    const { error: orderError } = await supabase.from("orders").update({
      client_id: clientId || null,
      client_name: selectedClient?.name ?? order.client_name ?? null,
      order_date: orderDate,
      delivery_date: deliveryDate || null,
      document_type: documentType,
      status: shouldConfirm ? "pending" : documentType,
      tax_rate: items[0]?.tax_rate ?? order.tax_rate,
      subtotal_amount: totals.subtotal,
      tax_amount: totals.tax,
      total_amount: totals.total,
      payment_type: paymentType,
      payment_status: paymentStatus,
      amount_paid: paidAmount,
      due_date: paymentStatus === "paid" ? null : dueDate || null,
      paid_at: paymentStatus === "paid" ? new Date().toISOString() : null,
      notes: notes || null,
    }).eq("id", order.id);

    if (orderError) {
      toast.error("No se pudo actualizar la venta");
      setSaving(false);
      return;
    }

    if (shouldConfirm) {
      const { error: confirmError } = await supabase.rpc("confirm_order_and_commit_inventory", { p_order_id: order.id });
      if (confirmError) {
        toast.error(confirmError.message || "La venta se guardo, pero no se pudo confirmar inventario");
        setSaving(false);
        return;
      }
    }

    toast.success("Venta actualizada");
    router.push("/sales");
    router.refresh();
  }

  if (loading) return <div className="card p-6 text-sm text-text-secondary">Cargando venta...</div>;
  if (!order) return <div className="card p-6 text-sm text-text-secondary">Venta no encontrada</div>;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/sales" className="btn-ghost p-2"><ArrowLeft className="w-4 h-4" /></Link>
          <h1 className="page-title">Editar venta</h1>
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
                  <option value="boleta">Boleta</option>
                </select>
              </div>
              <div>
                <label className="label-base">Estado de pago</label>
                <select className="input-base" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>
                  <option value="paid">Pagado</option>
                  <option value="pending">Pendiente de pago</option>
                  <option value="partial">Pago parcial</option>
                </select>
              </div>
              <div>
                <label className="label-base">Medio de pago</label>
                <select className="input-base" value={paymentType} onChange={(event) => setPaymentType(event.target.value as PaymentType)}>
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="credit">Credito</option>
                </select>
              </div>
              {paymentStatus === "partial" && <div>
                <label className="label-base">Monto pagado</label>
                <input type="number" min="0" step="0.01" className="input-base font-mono" value={amountPaid} onChange={(event) => setAmountPaid(Number(event.target.value))} />
              </div>}
              {paymentStatus !== "paid" && <div>
                <label className="label-base">Vencimiento pago</label>
                <input type="date" className="input-base" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </div>}
              <div>
                <label className="label-base">Cliente</label>
                <select className="input-base" value={clientId} onChange={(event) => setClientId(event.target.value)}>
                  <option value="">Sin cliente asignado</option>
                  {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label-base">Fecha</label>
                <input type="date" className="input-base" value={orderDate} onChange={(event) => setOrderDate(event.target.value)} />
              </div>
              <div>
                <label className="label-base">Entrega</label>
                <input type="date" className="input-base" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} />
              </div>
              <div className="md:col-span-3">
                <label className="label-base">Notas</label>
                <input className="input-base" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <p className="section-title mb-0">Productos</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => addItem("green")}><Plus className="w-4 h-4" /> Cafe verde</button>
                <button type="button" className="btn-secondary" onClick={() => addItem("roasted")}><Plus className="w-4 h-4" /> Cafe tostado</button>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {items.map((item, index) => {
                const subtotal = itemSubtotal(item);
                const tax = itemTax(item);
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
                        </select>
                      </div>

                      {item.product_type === "green" ? (
                        <>
                          <div>
                            <label className="label-base">Cafe verde</label>
                            <select className="input-base" value={item.green_coffee_id} onChange={(event) => updateItem(item.id, { green_coffee_id: event.target.value })}>
                              <option value="">Seleccionar cafe...</option>
                              {greenCoffees.map((coffee) => <option key={coffee.id} value={coffee.id}>{coffee.name} - {coffee.current_stock_kg.toFixed(2)} kg</option>)}
                            </select>
                          </div>
                          <div><label className="label-base">Kg</label><input type="number" min="0" step="0.001" className="input-base font-mono" value={item.green_weight_kg} onChange={(event) => updateItem(item.id, { green_weight_kg: Number(event.target.value) })} /></div>
                          <div><label className="label-base">Precio por kg</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={item.unit_price} onChange={(event) => updateItem(item.id, { unit_price: Number(event.target.value) })} /></div>
                        </>
                      ) : (
                        <>
                          <div>
                            <label className="label-base">Lote tostado</label>
                            <select className="input-base" value={item.roast_batch_id} onChange={(event) => updateItem(item.id, { roast_batch_id: event.target.value })}>
                              <option value="">Seleccionar lote...</option>
                              {batchOptions.map(({ batch, remainingKg }) => <option key={batch.id} value={batch.id}>{batch.green_coffees?.name} - {new Date(batch.roast_date).toLocaleDateString("es-UY")} - {remainingKg.toFixed(2)} kg</option>)}
                            </select>
                          </div>
                          <div><label className="label-base">Presentacion</label><select className="input-base" value={item.weight_grams} onChange={(event) => updateItem(item.id, { weight_grams: Number(event.target.value) })}>{weightOptions.map((weight) => <option key={weight.value} value={weight.value}>{weight.label}</option>)}</select></div>
                          <div><label className="label-base">Cantidad</label><input type="number" min="1" step="1" className="input-base font-mono" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} /></div>
                          <div><label className="label-base">Precio unitario</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={item.unit_price} onChange={(event) => updateItem(item.id, { unit_price: Number(event.target.value) })} /></div>
                        </>
                      )}

                      <div><label className="label-base">IVA item</label><input type="number" min="0" step="0.01" className="input-base font-mono" value={item.tax_rate} onChange={(event) => updateItem(item.id, { tax_rate: Number(event.target.value) })} /></div>
                      <div><label className="label-base">Notas item</label><input className="input-base" value={item.notes} onChange={(event) => updateItem(item.id, { notes: event.target.value })} /></div>
                    </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-xs bg-[#F8FAFC] rounded-lg p-3">
                      <div><p className="text-text-secondary">Subtotal</p><p className="font-mono font-medium">{formatCurrency(subtotal, roaster?.currency)}</p></div>
                      <div><p className="text-text-secondary">IVA</p><p className="font-mono font-medium">{formatCurrency(tax, roaster?.currency)}</p></div>
                      <div><p className="text-text-secondary">Total</p><p className="font-mono font-semibold text-text-primary">{formatCurrency(subtotal + tax, roaster?.currency)}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/sales" className="btn-secondary flex-1 justify-center">Cancelar</Link>
            <button type="button" className="btn-primary flex-1 justify-center" onClick={save} disabled={saving}>
              <Save className="w-4 h-4" /> {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="card p-5 sticky top-6">
            <p className="text-sm font-semibold text-text-primary mb-4">Resumen</p>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between"><span className="text-text-secondary">Subtotal</span><span className="font-mono">{formatCurrency(totals.subtotal, roaster?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">IVA</span><span className="font-mono">{formatCurrency(totals.tax, roaster?.currency)}</span></div>
              <div className="border-t border-border-default pt-3 flex justify-between"><span className="font-semibold">Total</span><span className="font-mono font-bold text-text-primary">{formatCurrency(totals.total, roaster?.currency)}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Pagado</span><span className="font-mono">{formatCurrency(paymentStatus === "paid" ? totals.total : paymentStatus === "pending" ? 0 : amountPaid, roaster?.currency)}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
