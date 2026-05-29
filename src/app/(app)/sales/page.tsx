import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SalesClient } from "./SalesClient";
import { currentMonthRange } from "@/lib/utils";

export default async function SalesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("id, currency").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { start } = currentMonthRange();

  const [{ data: sales }, { data: monthSales }] = await Promise.all([
    supabase
      .from("sales")
      .select("*, roast_batches(green_coffees(name)), green_coffees(name), clients(name)")
      .eq("roaster_id", roaster.id)
      .order("sale_date", { ascending: false }),
    supabase
      .from("sales")
      .select("final_price, profit, quantity")
      .eq("roaster_id", roaster.id)
      .gte("sale_date", start),
  ]);

  type MonthlySale = { final_price: number; profit: number; quantity: number };
  const totalRevenue = (monthSales ?? []).reduce((s: number, x: MonthlySale) => s + x.final_price, 0);
  const totalProfit = (monthSales ?? []).reduce((s: number, x: MonthlySale) => s + x.profit, 0);
  const totalUnits = (monthSales ?? []).reduce((s: number, x: MonthlySale) => s + x.quantity, 0);
  const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  return (
    <SalesClient
      sales={sales ?? []}
      currency={roaster.currency}
      totalRevenue={totalRevenue}
      totalProfit={totalProfit}
      totalUnits={totalUnits}
      avgMargin={avgMargin}
    />
  );
}
