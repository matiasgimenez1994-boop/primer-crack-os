import { createClient } from"@/lib/supabase/server";
import { redirect } from"next/navigation";
import { LabelsClient } from"./LabelsClient";

export default async function LabelsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters").select("*").eq("user_id", user.id).single();
  if (!roaster) redirect("/onboarding");

  const { data: batches } = await supabase
    .from("roast_batches")
    .select("*, green_coffees(name, origin_country, farm_producer, variety, process, tasting_notes, score)")
    .eq("roaster_id", roaster.id)
    .eq("status","production")
    .order("roast_date", { ascending: false })
    .limit(50);

  return (<LabelsClient
      roasterName={roaster.business_name}
      batches={batches ?? []}
      currency={roaster.currency}
    />);
}
