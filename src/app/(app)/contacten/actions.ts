"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateContact(
  id: string,
  fields: { vereniging?: string; contactpersoon?: string; telefoon?: string }
) {
  const supabase = await createClient();
  await supabase
    .from("contacts")
    .update({
      vereniging: fields.vereniging?.trim() || null,
      contactpersoon: fields.contactpersoon?.trim() || null,
      telefoon: fields.telefoon?.trim() || null,
    })
    .eq("id", id);

  revalidatePath("/contacten");
  revalidatePath("/reservaties");
  revalidatePath("/zaalbezetting");
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  await supabase.from("contacts").delete().eq("id", id);

  revalidatePath("/contacten");
  revalidatePath("/reservaties");
  revalidatePath("/zaalbezetting");
}
