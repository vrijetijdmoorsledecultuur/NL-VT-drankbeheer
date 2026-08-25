import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Building, Profile } from "@/lib/types";
import RapportenView from "@/components/RapportenView";

export default async function RapportenPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>();
  if (profile?.role === "theatertechnieker") redirect("/dashboard");

  const { data: buildings } = await supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name");

  return <RapportenView buildings={(buildings as Building[]) || []} />;
}
