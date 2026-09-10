import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Building, Reservation, ReservationToegangscode, Profile } from "@/lib/types";
import ToegangscodesView from "@/components/ToegangscodesView";

export default async function ToegangscodesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: profile }, { data: buildings }, { data: reservations }, { data: toegangscodes }] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role").eq("id", user!.id).single<Profile>(),
    supabase.from("buildings").select("id, name, actief").eq("actief", true).order("name"),
    supabase
      .from("reservations")
      .select("id, building_id, huurder, activiteit, ruimte, begin_datum, eind_datum, status")
      .order("begin_datum", { ascending: false })
      .limit(200),
    supabase
      .from("reservation_toegangscodes")
      .select("id, reservation_id, code, geldig_vanaf, geldig_tot, verstuur_email, verstuur_op, verstuurd, created_at")
      .order("created_at", { ascending: false }),
  ]);
  if (profile?.role === "theatertechnieker") redirect("/dashboard");

  const canEdit = profile?.role === "systeembeheerder" || profile?.role === "administratie" || profile?.role === "gebouwbeheerder";
  if (!canEdit) redirect("/dashboard");

  return (
    <ToegangscodesView
      buildings={(buildings as Building[]) || []}
      reservations={(reservations as Reservation[]) || []}
      toegangscodes={(toegangscodes as ReservationToegangscode[]) || []}
    />
  );
}
