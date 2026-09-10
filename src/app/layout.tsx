import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import type { Profile } from "@/lib/types";
import { weergavenaam } from "@/lib/naam";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, logboek_laatst_bekeken")
    .eq("id", user.id)
    .single<Profile & { logboek_laatst_bekeken: string | null }>();

  const role = profile?.role ?? "administratie";
  const displayName = weergavenaam(profile?.full_name, profile?.email || user.email);

  let logboekOngelezen = 0;
  let controleOngelezen = 0;
  if (role !== "theatertechnieker") {
    let query = supabase.from("logboek").select("id", { count: "exact", head: true });
    if (profile?.logboek_laatst_bekeken) query = query.gt("created_at", profile.logboek_laatst_bekeken);
    const [{ count: logboekCount }, { count: tellingenCount }, { count: facturenCount }] = await Promise.all([
      query,
      supabase.from("ruwe_tellingen").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("facturen").select("id", { count: "exact", head: true }).eq("status", "open"),
    ]);
    logboekOngelezen = logboekCount ?? 0;
    controleOngelezen = (tellingenCount ?? 0) + (facturenCount ?? 0);
  }

  return (
    <AppShell role={role} logboekOngelezen={logboekOngelezen} controleOngelezen={controleOngelezen} displayName={displayName}>
      {children}
    </AppShell>
  );
}
