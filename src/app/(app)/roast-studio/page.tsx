import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RoastStudioClient } from "./RoastStudioClient";

export default async function RoastStudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: roaster } = await supabase
    .from("roasters")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!roaster) redirect("/onboarding");

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Roast Studio</h1>
          <p className="text-sm text-text-secondary">Software propio de tueste para Yoshan 3 kg</p>
        </div>
      </div>
      <RoastStudioClient />
    </div>
  );
}
