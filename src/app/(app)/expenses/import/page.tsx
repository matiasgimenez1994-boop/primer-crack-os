import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ExpenseImportClient } from "./ExpenseImportClient";
import type { Expense } from "@/types";

export default async function ExpenseImportPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: roaster } = await supabase.from("roasters")
    .select("id, currency").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");
  const { data: expenses } = await supabase.from("expenses")
    .select("*").eq("roaster_id", roaster.id);
  return <ExpenseImportClient roasterId={roaster.id}
    fallbackCurrency={roaster.currency} existing={(expenses ?? []) as Expense[]} />;
}
