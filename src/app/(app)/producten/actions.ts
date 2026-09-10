"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Afrekenmodus } from "@/lib/types";

export async function addProduct(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const prijs = Number(formData.get("prijs") || 0);
  const categorie = String(formData.get("categorie") || "Diversen");
  const verpakking = Number(formData.get("verpakking") || 1);
  const afrekenmodus = String(formData.get("afrekenmodus") || "standaard") as Afrekenmodus;
  if (!name) return;

  const supabase = await createClient();
  await supabase.from("products").insert({ name, prijs, categorie, verpakking, afrekenmodus });
  revalidatePath("/producten");
}

export async function updateProductField(
  id: string,
  field: "name" | "prijs" | "categorie" | "verpakking" | "actief" | "afrekenmodus",
  value: string | number | boolean
) {
  const supabase = await createClient();
  await supabase.from("products").update({ [field]: value }).eq("id", id);

  // Een prijswijziging via dit snelle veld geldt vanaf vandaag — bewaar ze
  // meteen ook in de geschiedenis, zodat oudere reservaties/facturen straks
  // niet per ongeluk dit nieuwe bedrag overnemen.
  if (field === "prijs") {
    const datum = new Date().toISOString().slice(0, 10);
    await supabase.from("product_prijzen").insert({ product_id: id, prijs: value as number, geldig_vanaf: datum });
  }

  revalidatePath("/producten");
}

export async function plantPrijswijziging(productId: string, prijs: number, geldigVanaf: string) {
  const supabase = await createClient();
  const vandaag = new Date().toISOString().slice(0, 10);

  await supabase.from("product_prijzen").insert({ product_id: productId, prijs, geldig_vanaf: geldigVanaf });

  // Is de nieuwe prijs vandaag al van toepassing (of in het verleden), werk
  // dan meteen ook het "huidige prijs"-veld bij dat elders in de app als
  // snelle weergave gebruikt wordt.
  if (geldigVanaf <= vandaag) {
    await supabase.from("products").update({ prijs }).eq("id", productId);
  }

  revalidatePath("/producten");
  revalidatePath("/verwerking");
}

export async function verwijderPrijsRegel(id: string) {
  const supabase = await createClient();
  await supabase.from("product_prijzen").delete().eq("id", id);
  revalidatePath("/producten");
}

export async function deleteProduct(id: string) {
  const supabase = await createClient();
  await supabase.from("products").delete().eq("id", id);
  revalidatePath("/producten");
}

export async function toggleStandaard(productId: string, buildingId: string, isStandaard: boolean) {
  const supabase = await createClient();
  if (isStandaard) {
    await supabase.from("product_buildings").insert({ product_id: productId, building_id: buildingId });
  } else {
    await supabase.from("product_buildings").delete().match({ product_id: productId, building_id: buildingId });
  }
  revalidatePath("/producten");
}

export async function moveProductOrder(buildingId: string, productId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("product_buildings")
    .select("product_id, volgorde")
    .eq("building_id", buildingId)
    .order("volgorde", { ascending: true })
    .order("product_id", { ascending: true });
  if (!links) return;

  const index = links.findIndex((l) => l.product_id === productId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= links.length) return;

  const reordered = [...links];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

  // Ken telkens opnieuw volgnummers 0..n-1 toe op basis van de nieuwe volgorde
  // (robuuster dan enkel twee waarden omwisselen, want bij de start hebben
  // alle rijen dezelfde standaardwaarde 0).
  await Promise.all(
    reordered.map((l, i) =>
      supabase.from("product_buildings").update({ volgorde: i }).match({ product_id: l.product_id, building_id: buildingId })
    )
  );
  revalidatePath("/producten");
}

export async function moveTelplekProductOrder(telplekId: string, productId: string, direction: "up" | "down") {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("telplek_producten")
    .select("product_id, volgorde")
    .eq("telplek_id", telplekId)
    .order("volgorde", { ascending: true })
    .order("product_id", { ascending: true });
  if (!links) return;

  const index = links.findIndex((l) => l.product_id === productId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= links.length) return;

  const reordered = [...links];
  [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

  await Promise.all(
    reordered.map((l, i) =>
      supabase.from("telplek_producten").update({ volgorde: i }).match({ product_id: l.product_id, telplek_id: telplekId })
    )
  );
  revalidatePath("/producten");
}
