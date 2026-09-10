"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logboekRegel } from "@/lib/logboek";

export async function addLeverancier(naam: string, email: string, telefoon: string) {
  if (!naam.trim()) return;
  const supabase = await createClient();
  const { data } = await supabase
    .from("leveranciers")
    .insert({ naam: naam.trim(), email: email.trim() || null, telefoon: telefoon.trim() || null })
    .select("id")
    .single();
  revalidatePath("/bestellingen");
  return data?.id as string | undefined;
}

export async function updateLeverancier(id: string, fields: { naam?: string; email?: string; telefoon?: string }) {
  const supabase = await createClient();
  await supabase
    .from("leveranciers")
    .update({
      ...(fields.naam !== undefined ? { naam: fields.naam.trim() } : {}),
      ...(fields.email !== undefined ? { email: fields.email.trim() || null } : {}),
      ...(fields.telefoon !== undefined ? { telefoon: fields.telefoon.trim() || null } : {}),
    })
    .eq("id", id);
  revalidatePath("/bestellingen");
}

export async function toggleLeverancierActief(id: string, actief: boolean) {
  const supabase = await createClient();
  await supabase.from("leveranciers").update({ actief }).eq("id", id);
  revalidatePath("/bestellingen");
}

export async function createBestelling(
  buildingId: string,
  leverancierId: string | null,
  regels: { productId: string; aantal: number }[],
  aangemaaktDoor: string
) {
  const supabase = await createClient();
  const { data: bestelling } = await supabase
    .from("bestellingen")
    .insert({ building_id: buildingId, leverancier_id: leverancierId, aangemaakt_door: aangemaaktDoor || null })
    .select("id")
    .single();
  if (!bestelling) return null;

  const filtered = regels.filter((r) => r.aantal > 0);
  if (filtered.length > 0) {
    await supabase.from("bestelling_regels").insert(
      filtered.map((r) => ({ bestelling_id: bestelling.id, product_id: r.productId, besteld_aantal: r.aantal }))
    );
  }

  const { data: gebouw } = await supabase.from("buildings").select("name").eq("id", buildingId).single();
  await logboekRegel(supabase, "bestelling_aangemaakt", `Bestelling aangemaakt voor ${gebouw?.name || "?"} (${filtered.length} product(en))`, {
    buildingId,
  });

  revalidatePath("/bestellingen");
  revalidatePath("/voorraad");
  return bestelling.id as string;
}

export async function updateBestellingRegel(bestellingId: string, productId: string, bestelAantal: number) {
  const supabase = await createClient();
  if (bestelAantal <= 0) {
    await supabase.from("bestelling_regels").delete().match({ bestelling_id: bestellingId, product_id: productId });
  } else {
    await supabase
      .from("bestelling_regels")
      .upsert({ bestelling_id: bestellingId, product_id: productId, besteld_aantal: bestelAantal }, { onConflict: "bestelling_id,product_id" });
  }
  revalidatePath("/bestellingen");
}

export async function updateBestellingLeverancier(bestellingId: string, leverancierId: string | null) {
  const supabase = await createClient();
  await supabase.from("bestellingen").update({ leverancier_id: leverancierId }).eq("id", bestellingId);
  revalidatePath("/bestellingen");
}

export async function markeerVerstuurd(bestellingId: string) {
  const supabase = await createClient();
  await supabase.from("bestellingen").update({ status: "verstuurd", verstuurd_op: new Date().toISOString() }).eq("id", bestellingId);
  const { data: bestelling } = await supabase.from("bestellingen").select("building_id").eq("id", bestellingId).single();
  await logboekRegel(supabase, "bestelling_verstuurd", "Bestelling gemarkeerd als verstuurd", { buildingId: bestelling?.building_id });
  revalidatePath("/bestellingen");
}

export async function annuleerBestelling(bestellingId: string) {
  const supabase = await createClient();
  await supabase.from("bestellingen").update({ status: "geannuleerd" }).eq("id", bestellingId);
  const { data: bestelling } = await supabase.from("bestellingen").select("building_id").eq("id", bestellingId).single();
  await logboekRegel(supabase, "bestelling_geannuleerd", "Bestelling geannuleerd", { buildingId: bestelling?.building_id });
  revalidatePath("/bestellingen");
}

export async function bevestigLevering(
  bestellingId: string,
  buildingId: string,
  ontvangst: { productId: string; aantal: number }[],
  wie: string,
  bewijsUrl?: string | null
) {
  const supabase = await createClient();
  const datum = new Date().toISOString().slice(0, 10);

  const teVerwerken = ontvangst.filter((r) => r.aantal > 0);
  for (const r of teVerwerken) {
    await supabase.from("leveringen").insert({
      building_id: buildingId,
      datum,
      product_id: r.productId,
      aantal: r.aantal,
      wie: wie || null,
      bewijs_url: bewijsUrl || null,
    });

    const { data: huidig } = await supabase
      .from("bestelling_regels")
      .select("geleverd_aantal")
      .match({ bestelling_id: bestellingId, product_id: r.productId })
      .single();
    await supabase
      .from("bestelling_regels")
      .update({ geleverd_aantal: (huidig?.geleverd_aantal ?? 0) + r.aantal })
      .match({ bestelling_id: bestellingId, product_id: r.productId });
  }

  const { data: alleRegels } = await supabase
    .from("bestelling_regels")
    .select("besteld_aantal, geleverd_aantal")
    .eq("bestelling_id", bestellingId);

  const volledig = (alleRegels || []).every((r) => r.geleverd_aantal >= r.besteld_aantal);
  const gedeeltelijk = (alleRegels || []).some((r) => r.geleverd_aantal > 0);
  await supabase
    .from("bestellingen")
    .update({ status: volledig ? "geleverd" : gedeeltelijk ? "deels_geleverd" : "verstuurd" })
    .eq("id", bestellingId);

  const aantalOntvangen = teVerwerken.reduce((s, r) => s + r.aantal, 0);
  await logboekRegel(
    supabase,
    "levering_bevestigd",
    `Levering bevestigd: ${aantalOntvangen} stuk(s) over ${teVerwerken.length} product(en)${volledig ? " — volledig" : " — deels"}`,
    { buildingId }
  );

  revalidatePath("/bestellingen");
  revalidatePath("/voorraad");
}

export async function setVoorraadDrempel(productId: string, buildingId: string, minimum: number | null, streef: number | null) {
  const supabase = await createClient();
  await supabase
    .from("product_buildings")
    .update({ minimum_voorraad: minimum, streef_voorraad: streef })
    .match({ product_id: productId, building_id: buildingId });
  revalidatePath("/voorraad");
}
