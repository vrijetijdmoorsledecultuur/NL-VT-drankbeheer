"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verstuurToegangscodeMail } from "@/lib/verstuurToegangscode";
import { logboekRegel } from "@/lib/logboek";

export async function setTelling(
  reservationId: string,
  productId: string,
  field: "vooraf" | "nadien",
  value: number | null
) {
  const supabase = await createClient();
  await supabase
    .from("reservation_product_tellingen")
    .upsert({ reservation_id: reservationId, product_id: productId, [field]: value }, { onConflict: "reservation_id,product_id" });
  revalidatePath("/controle");
}

export async function setTellingDetail(
  reservationId: string,
  productId: string,
  moment: "vooraf" | "nadien",
  waarden: { frigo: number | null; bakken: number | null; los: number | null },
  verpakking: number
) {
  const supabase = await createClient();

  // Totaal enkel invullen zodra er minstens ergens een waarde staat — anders
  // blijft het gewoon "nog niet geteld", net als voorheen. Een "bak" is een
  // krat met meerdere flesjes — vermenigvuldigen met de verpakkingsgrootte,
  // net als bij Snelle Verwerking.
  const totaal =
    waarden.frigo == null && waarden.bakken == null && waarden.los == null
      ? null
      : (waarden.frigo ?? 0) + (waarden.bakken ?? 0) * (verpakking || 1) + (waarden.los ?? 0);

  const { error } = await supabase.from("reservation_product_tellingen").upsert(
    {
      reservation_id: reservationId,
      product_id: productId,
      [`${moment}_frigo`]: waarden.frigo,
      [`${moment}_bakken`]: waarden.bakken,
      [`${moment}_los`]: waarden.los,
      [moment]: totaal,
    },
    { onConflict: "reservation_id,product_id" }
  );
  revalidatePath("/controle");
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function addVerbruikRegel(
  kind: "levering" | "eigen_verbruik",
  input: {
    reservationId?: string | null;
    buildingId?: string | null;
    datum?: string | null;
    productId: string;
    aantal: number;
    wie: string;
  }
) {
  const supabase = await createClient();
  const table = kind === "levering" ? "leveringen" : "eigen_verbruik";
  await supabase.from(table).insert({
    reservation_id: input.reservationId || null,
    building_id: input.buildingId || null,
    datum: input.datum || null,
    product_id: input.productId,
    aantal: input.aantal,
    wie: input.wie || null,
  });

  const { data: product } = await supabase.from("products").select("name").eq("id", input.productId).single();
  const label = kind === "levering" ? "Levering" : "Eigen verbruik";
  await logboekRegel(supabase, kind, `${label}: ${input.aantal} x ${product?.name || "?"}`, {
    buildingId: input.buildingId || null,
    reservationId: input.reservationId || null,
  });

  revalidatePath("/controle");
  revalidatePath("/verwerking");
}

export async function removeVerbruikRegel(kind: "levering" | "eigen_verbruik", id: string) {
  const supabase = await createClient();
  const table = kind === "levering" ? "leveringen" : "eigen_verbruik";

  const { data: regel } = await supabase.from(table).select("product_id, building_id, reservation_id, aantal").eq("id", id).single();
  await supabase.from(table).delete().eq("id", id);

  if (regel) {
    const { data: product } = await supabase.from("products").select("name").eq("id", regel.product_id).single();
    const label = kind === "levering" ? "Levering" : "Eigen verbruik";
    await logboekRegel(supabase, `${kind}_verwijderd`, `${label} verwijderd: ${regel.aantal} x ${product?.name || "?"}`, {
      buildingId: regel.building_id,
      reservationId: regel.reservation_id,
    });
  }

  revalidatePath("/controle");
  revalidatePath("/verwerking");
}

export async function toggleBoete(reservationId: string, productId: string, checked: boolean, bewijsUrl?: string | null) {
  const supabase = await createClient();
  if (checked) {
    if (!bewijsUrl) {
      return { ok: false as const, error: "Bewijsmateriaal is verplicht bij een boete." };
    }
    await supabase
      .from("reservation_boetes")
      .upsert({ reservation_id: reservationId, product_id: productId, bewijs_url: bewijsUrl }, { onConflict: "reservation_id,product_id" });
  } else {
    await supabase.from("reservation_boetes").delete().match({ reservation_id: reservationId, product_id: productId });
  }

  const { data: product } = await supabase.from("products").select("name").eq("id", productId).single();
  await logboekRegel(
    supabase,
    checked ? "boete_aangevinkt" : "boete_afgevinkt",
    `${checked ? "Boete aangevinkt (met bewijs)" : "Boete verwijderd"}: ${product?.name || "?"}`,
    { reservationId }
  );

  revalidatePath("/controle");
  return { ok: true as const };
}

export async function toggleExtraProduct(reservationId: string, productId: string, checked: boolean) {
  const supabase = await createClient();
  if (checked) {
    await supabase.from("reservation_extra_producten").insert({ reservation_id: reservationId, product_id: productId });
  } else {
    await supabase.from("reservation_extra_producten").delete().match({ reservation_id: reservationId, product_id: productId });
  }
  revalidatePath("/controle");
}

export async function plantToegangscode(
  reservationId: string,
  email: string,
  verstuurOp: string,
  geldigTot: string
) {
  const supabase = await createClient();
  for (let poging = 0; poging < 5; poging++) {
    const code = Array.from({ length: 6 }, () => Math.floor(Math.random() * 10)).join("");
    const { error } = await supabase.from("reservation_toegangscodes").insert({
      reservation_id: reservationId,
      code,
      geldig_vanaf: verstuurOp,
      geldig_tot: geldigTot,
      verstuur_email: email,
      verstuur_op: verstuurOp,
    });
    if (!error) {
      await logboekRegel(supabase, "toegangscode_gepland", `Toegangscode ingepland naar ${email}`, { reservationId });
      revalidatePath("/controle");
      return { ok: true as const };
    }
    if (!error.message.includes("duplicate")) {
      return { ok: false as const, error: error.message };
    }
  }
  return { ok: false as const, error: "Kon geen unieke code genereren, probeer opnieuw." };
}

export async function verwijderToegangscode(id: string) {
  const supabase = await createClient();
  const { data: code } = await supabase.from("reservation_toegangscodes").select("verstuur_email, reservation_id").eq("id", id).single();
  await supabase.from("reservation_toegangscodes").delete().eq("id", id);
  if (code) {
    await logboekRegel(supabase, "toegangscode_verwijderd", `Toegangscode verwijderd (${code.verstuur_email || "?"})`, {
      reservationId: code.reservation_id,
    });
  }
  revalidatePath("/controle");
}

export async function verstuurToegangscodeNu(toegangscodeId: string, baseUrl: string) {
  const supabase = await createClient();
  const { data: item } = await supabase
    .from("reservation_toegangscodes")
    .select("id, code, verstuur_email, reservation_id, reservations(huurder, activiteit, buildings(name))")
    .eq("id", toegangscodeId)
    .single();
  if (!item) return { ok: false as const, error: "Code niet gevonden." };

  const res = await verstuurToegangscodeMail(
    supabase,
    item as unknown as Parameters<typeof verstuurToegangscodeMail>[1],
    baseUrl
  );
  if (res.ok) {
    await logboekRegel(supabase, "toegangscode_verstuurd", `Toegangscode handmatig verstuurd naar ${item.verstuur_email || "?"}`, {
      reservationId: item.reservation_id,
    });
  }
  revalidatePath("/controle");
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error || "Versturen mislukt." };
}

export async function approveRuweTelling(
  ruweTellingId: string,
  reservationId: string,
  type: "vooraf" | "nadien",
  regels: { productId: string; aantal: number; frigo?: number | null; bakken?: number | null; los?: number | null }[]
) {
  const supabase = await createClient();

  for (const regel of regels) {
    await supabase
      .from("reservation_product_tellingen")
      .upsert(
        {
          reservation_id: reservationId,
          product_id: regel.productId,
          [type]: regel.aantal,
          [`${type}_frigo`]: regel.frigo ?? null,
          [`${type}_bakken`]: regel.bakken ?? null,
          [`${type}_los`]: regel.los ?? null,
        },
        { onConflict: "reservation_id,product_id" }
      );
  }

  await supabase.from("ruwe_tellingen").update({ status: "verwerkt" }).eq("id", ruweTellingId);

  const { data: reservation } = await supabase.from("reservations").select("building_id").eq("id", reservationId).single();
  await logboekRegel(
    supabase,
    "telling_goedgekeurd",
    `Telling goedgekeurd (${type === "vooraf" ? "vooraf" : "nadien"}, ${regels.length} product(en))`,
    { reservationId, buildingId: reservation?.building_id }
  );

  revalidatePath("/controle");
}

export async function approveControletelling(
  ruweTellingId: string,
  buildingId: string,
  regels: { productId: string; aantal: number; frigo?: number | null; bakken?: number | null; los?: number | null }[]
) {
  const supabase = await createClient();
  const datum = new Date().toISOString().slice(0, 10);

  if (regels.length > 0) {
    await supabase.from("voorraad_controletellingen").insert(
      regels.map((r) => ({
        building_id: buildingId,
        product_id: r.productId,
        aantal: r.aantal,
        frigo: r.frigo ?? null,
        bakken: r.bakken ?? null,
        los: r.los ?? null,
        datum,
      }))
    );
  }

  await supabase.from("ruwe_tellingen").update({ status: "verwerkt" }).eq("id", ruweTellingId);

  await logboekRegel(supabase, "controletelling_goedgekeurd", `Controletelling goedgekeurd (${regels.length} product(en))`, {
    buildingId,
  });

  revalidatePath("/controle");
  revalidatePath("/voorraad");
}

export async function dismissRuweTelling(ruweTellingId: string) {
  const supabase = await createClient();
  const { data: ruwe } = await supabase.from("ruwe_tellingen").select("reservation_id, building_id, type").eq("id", ruweTellingId).single();
  await supabase.from("ruwe_tellingen").update({ status: "verwerkt" }).eq("id", ruweTellingId);
  if (ruwe) {
    const typeLabel = ruwe.type === "vooraf" ? "vooraf" : ruwe.type === "nadien" ? "nadien" : "controle";
    await logboekRegel(supabase, "telling_genegeerd", `Telling genegeerd (${typeLabel})`, {
      reservationId: ruwe.reservation_id,
      buildingId: ruwe.building_id,
    });
  }
  revalidatePath("/controle");
}

export async function approveReservation(reservationId: string) {
  const supabase = await createClient();
  await supabase.from("reservations").update({ status: "gecontroleerd" }).eq("id", reservationId);

  const { data: reservation } = await supabase.from("reservations").select("building_id, huurder").eq("id", reservationId).single();
  await logboekRegel(supabase, "reservatie_afgerond", `Reservatie afgerond: ${reservation?.huurder || "?"}`, {
    reservationId,
    buildingId: reservation?.building_id,
  });

  revalidatePath("/controle");
  revalidatePath("/dashboard");
  revalidatePath("/reservaties");
}

export async function toggleRecreatexVerwerkt(reservationId: string, verwerkt: boolean) {
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
    .from("reservations")
    .update({
      recreatex_verwerkt: verwerkt,
      recreatex_verwerkt_door: verwerkt ? naam : null,
      recreatex_verwerkt_op: verwerkt ? new Date().toISOString() : null,
    })
    .eq("id", reservationId);

  const { data: reservation } = await supabase.from("reservations").select("building_id, huurder").eq("id", reservationId).single();
  await logboekRegel(
    supabase,
    verwerkt ? "recreatex_verwerkt" : "recreatex_heropend",
    `${verwerkt ? "Gemarkeerd als verwerkt in Recreatex" : "Recreatex-markering teruggezet"}: ${reservation?.huurder || "?"}`,
    { reservationId, buildingId: reservation?.building_id }
  );

  revalidatePath("/controle");
  revalidatePath("/reservaties");
  revalidatePath("/dashboard");
}
