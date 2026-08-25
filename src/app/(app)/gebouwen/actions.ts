"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addBuilding(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("buildings").insert({ name });
  revalidatePath("/gebouwen");
}

export async function renameBuilding(id: string, name: string) {
  const supabase = await createClient();
  await supabase.from("buildings").update({ name }).eq("id", id);
  revalidatePath("/gebouwen");
}

export async function toggleBuildingActief(id: string, actief: boolean) {
  const supabase = await createClient();
  await supabase.from("buildings").update({ actief }).eq("id", id);
  revalidatePath("/gebouwen");
}

export async function deleteBuilding(id: string) {
  const supabase = await createClient();
  await supabase.from("buildings").delete().eq("id", id);
  revalidatePath("/gebouwen");
}

export async function regenerateUniversalTellerToken() {
  const supabase = await createClient();
  const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  await supabase.from("teller_instellingen").update({ token }).eq("id", true);
  revalidatePath("/gebouwen");
}

export async function addTelplek(buildingId: string, naam: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("telplekken")
    .select("volgorde")
    .eq("building_id", buildingId)
    .order("volgorde", { ascending: false })
    .limit(1)
    .single();
  const volgorde = (data?.volgorde ?? 0) + 1;
  await supabase.from("telplekken").insert({ building_id: buildingId, naam, volgorde });
  revalidatePath("/gebouwen");
}

export async function updateTelplek(
  id: string,
  fields: { naam?: string; heeft_vaste_voorraad?: boolean; vereist_telplek_id?: string | null; actief?: boolean }
) {
  const supabase = await createClient();
  await supabase.from("telplekken").update(fields).eq("id", id);
  revalidatePath("/gebouwen");
}

export async function deleteTelplek(id: string) {
  const supabase = await createClient();
  await supabase.from("telplekken").delete().eq("id", id);
  revalidatePath("/gebouwen");
}

export async function setTelplekProduct(telplekId: string, productId: string, mode: "standaard" | "optioneel" | "geen") {
  const supabase = await createClient();
  if (mode === "geen") {
    await supabase.from("telplek_producten").delete().match({ telplek_id: telplekId, product_id: productId });
  } else {
    await supabase
      .from("telplek_producten")
      .upsert(
        { telplek_id: telplekId, product_id: productId, standaard: mode === "standaard" },
        { onConflict: "telplek_id,product_id" }
      );
  }
  revalidatePath("/gebouwen");
}

export async function setVasteVoorraadRegel(telplekId: string, productId: string, aantal: number) {
  const supabase = await createClient();
  if (aantal <= 0) {
    await supabase.from("telplek_vaste_voorraad").delete().match({ telplek_id: telplekId, product_id: productId });
  } else {
    await supabase
      .from("telplek_vaste_voorraad")
      .upsert({ telplek_id: telplekId, product_id: productId, aantal }, { onConflict: "telplek_id,product_id" });
  }
  revalidatePath("/gebouwen");
}
