"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logboekRegel } from "@/lib/logboek";

export async function addVerplaatsing(input: {
  productId: string;
  vanBuildingId: string;
  naarBuildingId: string;
  aantal: number;
  datum: string;
  reden: string;
  wie: string;
}) {
  const supabase = await createClient();
  await supabase.from("voorraadverplaatsingen").insert({
    product_id: input.productId,
    van_building_id: input.vanBuildingId,
    naar_building_id: input.naarBuildingId,
    aantal: input.aantal,
    datum: input.datum,
    reden: input.reden || null,
    wie: input.wie || null,
  });

  const [{ data: product }, { data: vanGebouw }, { data: naarGebouw }] = await Promise.all([
    supabase.from("products").select("name").eq("id", input.productId).single(),
    supabase.from("buildings").select("name").eq("id", input.vanBuildingId).single(),
    supabase.from("buildings").select("name").eq("id", input.naarBuildingId).single(),
  ]);
  await logboekRegel(
    supabase,
    "verplaatsing",
    `Verplaatsing: ${input.aantal} x ${product?.name || "?"} van ${vanGebouw?.name || "?"} naar ${naarGebouw?.name || "?"}`,
    { buildingId: input.vanBuildingId }
  );

  revalidatePath("/verwerking");
}

export async function removeVerplaatsing(id: string) {
  const supabase = await createClient();
  await supabase.from("voorraadverplaatsingen").delete().eq("id", id);
  revalidatePath("/verwerking");
}

export async function createFactuur(input: {
  buildingId: string;
  naam: string;
  type: "factuur" | "creditnota";
  datum: string;
  regels: { productId: string; aantal: number; prijs: number }[];
  wie: string;
}) {
  const supabase = await createClient();
  const bedrag = input.regels.reduce((s, r) => s + r.aantal * r.prijs, 0);
  const { data: factuur, error } = await supabase
    .from("facturen")
    .insert({ building_id: input.buildingId, naam: input.naam, type: input.type, datum: input.datum, bedrag, wie: input.wie || null })
    .select("id")
    .single();
  if (error || !factuur) return;

  const filtered = input.regels.filter((r) => r.aantal > 0);
  if (filtered.length > 0) {
    await supabase.from("factuur_regels").insert(
      filtered.map((r) => ({ factuur_id: factuur.id, product_id: r.productId, aantal: r.aantal, prijs: r.prijs }))
    );
  }

  const { data: gebouw } = await supabase.from("buildings").select("name").eq("id", input.buildingId).single();
  await logboekRegel(
    supabase,
    "factuur_aangemaakt",
    `${input.type === "factuur" ? "Factuur" : "Creditnota"} voor ${input.naam} (${gebouw?.name || "?"}): €${bedrag.toFixed(2)}`,
    { buildingId: input.buildingId }
  );

  revalidatePath("/verwerking");
  revalidatePath("/rapporten");
}

export async function goedkeurFactuur(factuurId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let naam: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
    const heeftEchteNaam = !!profile?.full_name && !profile.full_name.includes("@");
    naam = heeftEchteNaam ? profile!.full_name! : profile?.email || null;
  }

  await supabase
    .from("facturen")
    .update({ status: "goedgekeurd", goedgekeurd_door: naam, goedgekeurd_op: new Date().toISOString() })
    .eq("id", factuurId);

  const { data: factuur } = await supabase.from("facturen").select("naam, building_id").eq("id", factuurId).single();
  await logboekRegel(supabase, "factuur_goedgekeurd", `Factuur goedgekeurd: ${factuur?.naam || "?"}`, {
    buildingId: factuur?.building_id,
  });

  revalidatePath("/controle");
  revalidatePath("/verwerking");
}

export async function toggleFactuurRecreatex(factuurId: string, verwerkt: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let naam: string | null = null;
  if (verwerkt && user) {
    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", user.id).single();
    const heeftEchteNaam = !!profile?.full_name && !profile.full_name.includes("@");
    naam = heeftEchteNaam ? profile!.full_name! : profile?.email || null;
  }

  await supabase
    .from("facturen")
    .update({
      recreatex_verwerkt: verwerkt,
      recreatex_verwerkt_door: verwerkt ? naam : null,
      recreatex_verwerkt_op: verwerkt ? new Date().toISOString() : null,
    })
    .eq("id", factuurId);

  const { data: factuur } = await supabase.from("facturen").select("naam, building_id").eq("id", factuurId).single();
  await logboekRegel(
    supabase,
    verwerkt ? "recreatex_verwerkt" : "recreatex_heropend",
    `${verwerkt ? "Factuur gemarkeerd als verwerkt in Recreatex" : "Recreatex-markering teruggezet"}: ${factuur?.naam || "?"}`,
    { buildingId: factuur?.building_id }
  );

  revalidatePath("/verwerking");
  revalidatePath("/rapporten");
}
