import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExpensesClient } from "./ExpensesClient";
import type { Expense } from "@/types";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase.from("roasters")
    .select("id, currency, business_name").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { data: expenses, error } = await supabase.from("expenses")
    .select("*").eq("roaster_id", roaster.id)
    .order("expense_date", { ascending: false });

  return <ExpensesClient expenses={(expenses ?? []) as Expense[]}
    fallbackCurrency={roaster.currency} businessName={roaster.business_name} loadError={Boolean(error)} />;
}
