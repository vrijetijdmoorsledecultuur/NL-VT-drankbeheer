import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Building, Reservation, LogboekRegel, Profile } from "@/lib/types";
import LogboekView from "@/components/LogboekView";

export default async function LogboekPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>();
  if (profile?.role === "theatertechnieker") redirect("/dashboard");

  const [{ data: regels }, { data: buildings }, { data: reservations }] = await Promise.all([
    supabase.from("logboek").select("id, created_at, gebruiker_naam, actie, omschrijving, building_id, reservation_id").order("created_at", { ascending: false }).limit(300),
    supabase.from("buildings").select("id, name, actief"),
    supabase.from("reservations").select("id, building_id, huurder, activiteit, begin_datum, eind_datum, status"),
  ]);

  // Markeer als bekeken (voor de teller in de zijbalk) — ná het ophalen van de data.
  await supabase.from("profiles").update({ logboek_laatst_bekeken: new Date().toISOString() }).eq("id", user!.id);

  return (
    <LogboekView
      regels={(regels as LogboekRegel[]) || []}
      buildings={(buildings as Building[]) || []}
      reservations={(reservations as Reservation[]) || []}
    />
  );
}
