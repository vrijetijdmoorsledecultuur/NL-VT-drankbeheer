import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Building, Reservation, Contact, Profile } from "@/lib/types";
import ZaalbezettingView from "@/components/ZaalbezettingView";

export default async function ZaalbezettingPage({
  searchParams,
}: {
  searchParams: Promise<{ datum?: string }>;
}) {
  const { datum } = await searchParams;
  const selectedDate = datum || new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: buildings }, { data: reservations }, { data: contacts }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase
      .from("reservations")
      .select("id, building_id, contact_id, huurder, adres, telefoon, activiteit, ruimte, begin_datum, eind_datum, toegang_start, activiteit_start, activiteit_eind, toegang_eind, status, bron")
      .lte("begin_datum", selectedDate)
      .gte("eind_datum", selectedDate)
      .order("toegang_start"),
    supabase.from("contacts").select("id, ruwe_naam, vereniging, contactpersoon, telefoon, adres"),
  ]);
  if (profile?.role === "theatertechnieker") redirect("/dashboard");


  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";

  return (
    <ZaalbezettingView
      selectedDate={selectedDate}
      buildings={(buildings as Building[]) || []}
      reservations={(reservations as Reservation[]) || []}
      contacts={(contacts as Contact[]) || []}
      canEdit={canEdit}
    />
  );
}
