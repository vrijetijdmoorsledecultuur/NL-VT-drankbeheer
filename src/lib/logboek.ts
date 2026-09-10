import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Voegt één regel toe aan het centrale logboek. Wordt aangeroepen vanuit
 * server actions ná een geslaagde, betekenisvolle wijziging (goedkeuren,
 * verwijderen, registreren, ...). Faalt bewust stil bij een probleem — een
 * logboekfout mag nooit de eigenlijke actie laten mislukken.
 */
export async function logboekRegel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  actie: string,
  omschrijving: string,
  opts?: { buildingId?: string | null; reservationId?: string | null }
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let naam = "Onbekend";
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
      const heeftEchteNaam = !!profile?.full_name && !profile.full_name.includes("@");
      naam = heeftEchteNaam ? profile!.full_name! : profile?.email || naam;
    }

    await supabase.from("logboek").insert({
      gebruiker_naam: naam,
      actie,
      omschrijving,
      building_id: opts?.buildingId ?? null,
      reservation_id: opts?.reservationId ?? null,
    });
  } catch {
    // logboek is ondersteunend, nooit blokkerend
  }
}
