import { redirect } from"next/navigation";
import { createClient } from"@/lib/supabase/server";
import { AppLayout } from"@/components/layout/AppLayout";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if roaster profile exists
  const { data: roaster } = await supabase
    .from("roasters")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!roaster) redirect("/onboarding");

  return <AppLayout>{children}</AppLayout>;
}
