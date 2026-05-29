import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { formatCurrency, formatWeight, formatDate } from"@/lib/utils";
import { subMonths, startOfMonth, endOfMonth, format } from"date-fns";
import { es } from"date-fns/locale";
import type { RoastBatch, GreenCoffee, Sale } from"@/types";
import { ReportsClient } from"./ReportsClient";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("*").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const [
    { data: batches },
    { data: coffees },
    { data: sales },
  ] = await Promise.all([
    supabase.from("roast_batches")
      .select("*, green_coffees(name, purchase_price_per_kg)")
      .eq("roaster_id", roaster.id)
      .order("roast_date", { ascending: false }),
    supabase.from("green_coffees")
      .select("*").eq("roaster_id", roaster.id),
    supabase.from("sales")
      .select("*, clients(name), roast_batches(green_coffees(name))")
      .eq("roaster_id", roaster.id)
      .order("sale_date", { ascending: false }),
  ]);

  // ── Kg tostados por mes (últimos 6) ──
  const monthlyRoasting = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const start = format(startOfMonth(d),"yyyy-MM-dd");
    const end = format(endOfMonth(d),"yyyy-MM-dd");
    const mb = (batches ?? []).filter((b: RoastBatch) => b.roast_date >= start && b.roast_date <= end);
    return {
      month: format(d,"MMM yyyy", { locale: es }),
      kg: mb.reduce((s: number, b: RoastBatch) => s + b.roasted_weight_kg, 0),
      lotes: mb.length,
    };
  });

  // ── Ranking cafés por kg tostado ──
  const kgByCoffee: Record<string, { name: string; kg: number; lotes: number }> = {};
  (batches ?? []).forEach((b: RoastBatch) => {
    const name = b.green_coffees?.name ??"—";
    if (!kgByCoffee[b.green_coffee_id]) kgByCoffee[b.green_coffee_id] = { name, kg: 0, lotes: 0 };
    kgByCoffee[b.green_coffee_id].kg += b.roasted_weight_kg;
    kgByCoffee[b.green_coffee_id].lotes += 1;
  });
  const topRoasted = Object.values(kgByCoffee).sort((a, b) => b.kg - a.kg);

  // ── Ranking cafés por margen ──
  const marginByCoffee: Record<string, { name: string; totalRevenue: number; totalCost: number; batches: number }> = {};
  (batches ?? []).forEach((b: RoastBatch) => {
    const name = b.green_coffees?.name ??"—";
    if (!marginByCoffee[b.green_coffee_id]) {
      marginByCoffee[b.green_coffee_id] = { name, totalRevenue: 0, totalCost: 0, batches: 0 };
    }
    marginByCoffee[b.green_coffee_id].totalCost += b.total_cost_per_kg_roasted * b.roasted_weight_kg;
    marginByCoffee[b.green_coffee_id].batches += 1;
  });
  (sales ?? []).forEach((s: Sale) => {
    const name = (s as any).roast_batches?.green_coffees?.name;
    if (!name) return;
    const key = Object.keys(marginByCoffee).find(k => marginByCoffee[k].name === name);
    if (key) marginByCoffee[key].totalRevenue += s.final_price;
  });
  const topMargin = Object.values(marginByCoffee)
    .map(c => ({
      ...c,
      margin: c.totalRevenue > 0 ? ((c.totalRevenue - c.totalCost) / c.totalRevenue) * 100 : 0,
    }))
    .filter(c => c.totalRevenue > 0)
    .sort((a, b) => b.margin - a.margin);

  // ── Stock valorizado ──
  const stockValued = (coffees ?? [])
    .filter((c: GreenCoffee) => c.current_stock_kg > 0)
    .map((c: GreenCoffee) => ({
      name: c.name,
      origin: c.origin_country ??"—",
      kg: c.current_stock_kg,
      price: c.purchase_price_per_kg,
      value: c.current_stock_kg * c.purchase_price_per_kg,
      status: c.status,
    }))
    .sort((a, b) => b.value - a.value);

  const totalStockValue = stockValued.reduce((s, c) => s + c.value, 0);

  // ── Historial tuestes (tabla completa) ──
  const roastHistory = (batches ?? []).map((b: RoastBatch) => ({
    id: b.id,
    cafe: b.green_coffees?.name ??"—",
    fecha: b.roast_date,
    verde: b.green_weight_kg,
    tostado: b.roasted_weight_kg,
    merma: b.shrinkage_pct,
    costo: b.total_cost_per_kg_roasted,
    estado: b.status,
  }));

  // Datos para pasar al cliente
  const exportData = {
    roasterName: roaster.business_name,
    currency: roaster.currency,
    monthlyRoasting,
    topRoasted,
    topMargin,
    stockValued,
    totalStockValue,
    roastHistory,
    allSales: (sales ?? []).map((s: Sale) => ({
      fecha: s.sale_date,
      cliente: (s as any).clients?.name ?? s.client_name ??"—",
      producto: (s as any).roast_batches?.green_coffees?.name ?? (s as any).green_coffees?.name ??"—",
      tipo: s.product_type ==="roasted" ?"Tostado" :"Verde",
      cantidad: s.quantity,
      precio: s.unit_price,
      descuento: s.discount_pct,
      total: s.final_price,
      ganancia: s.profit,
      pago: s.payment_type ==="cash" ?"Efectivo" : s.payment_type ==="transfer" ?"Transferencia" :"Crédito",
      estado: s.payment_status ==="paid" ?"Pagado" : s.payment_status ==="partial" ?"Parcial" :"Pendiente",
    })),
  };

  return <ReportsClient data={exportData} />;
}
