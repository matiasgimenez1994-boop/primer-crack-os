import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SalesClient } from "./SalesClient";
import { currentMonthRange, formatCurrency } from "@/lib/utils";

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id, currency, business_name")
    .eq("user_id", user.id)
    .single();
  if (!roaster) redirect("/onboarding");

  const { start } = currentMonthRange();

  const [{ data: orders }, { data: monthOrders }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, clients(name), order_items(*, green_coffees(name), roast_batches(roast_date, green_coffees(name)))")
      .eq("roaster_id", roaster.id)
      .order("order_date", { ascending: false }),
    supabase
      .from("orders")
      .select("total_amount, payment_currency")
      .eq("roaster_id", roaster.id)
      .gte("order_date", start)
      .in("status", ["confirmed", "ready", "delivered"]),
  ]);

  type MonthlyOrder = { total_amount: number; payment_currency?: string | null };
  const monthlyTotalsByCurrency = (monthOrders ?? []).reduce<Record<string, number>>((acc: Record<string, number>, order: MonthlyOrder) => {
    const orderCurrency = order.payment_currency ?? roaster.currency ?? "USD";
    acc[orderCurrency] = (acc[orderCurrency] ?? 0) + Number(order.total_amount ?? 0);
    return acc;
  }, {});
  const totalRevenue = Object.entries(monthlyTotalsByCurrency)
    .filter(([, value]) => value !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([orderCurrency, value]) => formatCurrency(value, orderCurrency))
    .join(" / ") || formatCurrency(0, roaster.currency ?? "USD");
  const totalProfit = 0;
  const totalUnits = (orders ?? []).reduce((sum: number, order: any) => sum + (order.order_items?.length ?? 0), 0);
  const avgMargin = 0;

  return (
    <SalesClient
      orders={orders ?? []}
      currency={roaster.currency}
      businessName={roaster.business_name}
      totalRevenue={totalRevenue}
      totalProfit={totalProfit}
      totalUnits={totalUnits}
      avgMargin={avgMargin}
    />
  );
}
