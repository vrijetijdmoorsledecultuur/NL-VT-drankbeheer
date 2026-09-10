"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logboekRegel } from "@/lib/logboek";

export async function updateContact(
  id: string,
  fields: { vereniging?: string; contactpersoon?: string; telefoon?: string }
) {
  const supabase = await createClient();
  const nieuweVereniging = fields.vereniging?.trim() || null;

  await supabase
    .from("contacts")
    .update({
      vereniging: nieuweVereniging,
      contactpersoon: fields.contactpersoon?.trim() || null,
      telefoon: fields.telefoon?.trim() || null,
    })
    .eq("id", id);

  // Schrijf de naam meteen door naar alle gekoppelde reservaties, zodat elke
  // plek in de app (rapporten, snelle verwerking, zaalbezetting, ...) de
  // actuele naam toont zonder dat elk scherm apart de contactfiche moet
  // opzoeken.
  if (nieuweVereniging) {
    await supabase.from("reservations").update({ huurder: nieuweVereniging }).eq("contact_id", id);
  }

  revalidatePath("/contacten");
  revalidatePath("/reservaties");
  revalidatePath("/zaalbezetting");
  revalidatePath("/controle");
  revalidatePath("/verwerking");
  revalidatePath("/tellen");
  revalidatePath("/rapporten");
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const { data: contact } = await supabase.from("contacts").select("vereniging, ruwe_naam").eq("id", id).single();
  await supabase.from("contacts").delete().eq("id", id);
  if (contact) {
    await logboekRegel(supabase, "contact_verwijderd", `Contact verwijderd: ${contact.vereniging || contact.ruwe_naam}`);
  }

  revalidatePath("/contacten");
  revalidatePath("/reservaties");
  revalidatePath("/zaalbezetting");
}
