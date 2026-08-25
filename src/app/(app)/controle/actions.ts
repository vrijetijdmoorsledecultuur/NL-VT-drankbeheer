"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verstuurToegangscodeMail } from "@/lib/verstuurToegangscode";

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
  revalidatePath("/controle");
  revalidatePath("/verwerking");
}

export async function removeVerbruikRegel(kind: "levering" | "eigen_verbruik", id: string) {
  const supabase = await createClient();
  const table = kind === "levering" ? "leveringen" : "eigen_verbruik";
  await supabase.from(table).delete().eq("id", id);
  revalidatePath("/controle");
  revalidatePath("/verwerking");
}

export async function toggleBoete(reservationId: string, productId: string, checked: boolean) {
  const supabase = await createClient();
  if (checked) {
    await supabase.from("reservation_boetes").insert({ reservation_id: reservationId, product_id: productId });
  } else {
    await supabase.from("reservation_boetes").delete().match({ reservation_id: reservationId, product_id: productId });
  }
  revalidatePath("/controle");
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
      revalidatePath("/controle");
      return { ok: true as const };
    }
    if (!error.message.includes("duplicate")) {
      return { ok: false as const, error: error.message };
    }
  }
  return { ok: false as const, error: "Kon geen unieke code genereren, probeer opnieuw." };
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
  revalidatePath("/controle");
  return res.ok ? { ok: true as const } : { ok: false as const, error: res.error || "Versturen mislukt." };
}

export async function approveRuweTelling(
  ruweTellingId: string,
  reservationId: string,
  type: "vooraf" | "nadien",
  regels: { productId: string; aantal: number }[]
) {
  const supabase = await createClient();

  for (const regel of regels) {
    await supabase
      .from("reservation_product_tellingen")
      .upsert(
        { reservation_id: reservationId, product_id: regel.productId, [type]: regel.aantal },
        { onConflict: "reservation_id,product_id" }
      );
  }

  await supabase.from("ruwe_tellingen").update({ status: "verwerkt" }).eq("id", ruweTellingId);
  revalidatePath("/controle");
}

export async function dismissRuweTelling(ruweTellingId: string) {
  const supabase = await createClient();
  await supabase.from("ruwe_tellingen").update({ status: "verwerkt" }).eq("id", ruweTellingId);
  revalidatePath("/controle");
}

export async function approveReservation(reservationId: string) {
  const supabase = await createClient();
  await supabase.from("reservations").update({ status: "gecontroleerd" }).eq("id", reservationId);
  revalidatePath("/controle");
  revalidatePath("/dashboard");
  revalidatePath("/reservaties");
}
