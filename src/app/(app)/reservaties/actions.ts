"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseReservationsPdf, matchBuilding, type ParsedReservation } from "@/lib/pdfParser";

export type ExtractResult = {
  ok: boolean;
  error?: string;
  gebouwNaam?: string;
  matchedBuildingId?: string | null;
  reservations?: ParsedReservation[];
  warnings?: string[];
};

export async function extractPdf(formData: FormData): Promise<ExtractResult> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Geen bestand gekozen." };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, error: "Enkel PDF-bestanden worden ondersteund." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let result;
  try {
    result = await parseReservationsPdf(buffer);
  } catch (e) {
    return { ok: false, error: `Kon de PDF niet uitlezen: ${(e as Error).message}` };
  }

  const supabase = await createClient();
  const { data: buildings } = await supabase.from("buildings").select("id, name");
  const matchedBuildingId = matchBuilding(result.gebouwNaam, buildings || []);

  if (result.reservations.length === 0) {
    return {
      ok: false,
      error: "Er werden geen reservaties herkend in dit bestand. Controleer of het om hetzelfde type rapport gaat.",
      gebouwNaam: result.gebouwNaam,
      warnings: result.warnings,
    };
  }

  return {
    ok: true,
    gebouwNaam: result.gebouwNaam,
    matchedBuildingId,
    reservations: result.reservations,
    warnings: result.warnings,
  };
}

export type ReservationInput = {
  buildingId: string;
  huurder: string;
  adres: string;
  telefoon: string;
  activiteit: string;
  ruimte: string;
  beginDatum: string;
  eindDatum: string;
  toegangStart: string | null;
  activiteitStart: string | null;
  activiteitEind: string | null;
  toegangEind: string | null;
  bron: "pdf" | "manueel";
};

export async function saveReservations(items: ReservationInput[]) {
  if (items.length === 0) return { ok: false, error: "Niets om te bewaren." };

  const supabase = await createClient();

  // Voor elke unieke ruwe huurdersnaam: bestaand contact hergebruiken, of éénmalig aanmaken.
  // Latere uploads met dezelfde ruwe naam herkennen dit contact automatisch.
  const uniqueNamen = Array.from(new Set(items.map((i) => i.huurder.trim()).filter(Boolean)));
  const contactIdByNaam = new Map<string, string>();

  if (uniqueNamen.length > 0) {
    const { data: existing } = await supabase.from("contacts").select("id, ruwe_naam").in("ruwe_naam", uniqueNamen);
    for (const c of existing || []) contactIdByNaam.set(c.ruwe_naam, c.id);

    const missing = uniqueNamen.filter((n) => !contactIdByNaam.has(n));
    if (missing.length > 0) {
      const toInsert = missing.map((naam) => {
        const src = items.find((i) => i.huurder.trim() === naam);
        return { ruwe_naam: naam, telefoon: src?.telefoon || null, adres: src?.adres || null };
      });
      const { data: created } = await supabase.from("contacts").insert(toInsert).select("id, ruwe_naam");
      for (const c of created || []) contactIdByNaam.set(c.ruwe_naam, c.id);
    }
  }

  const rows = items.map((r) => ({
    building_id: r.buildingId,
    contact_id: contactIdByNaam.get(r.huurder.trim()) || null,
    huurder: r.huurder,
    adres: r.adres || null,
    telefoon: r.telefoon || null,
    activiteit: r.activiteit || null,
    ruimte: r.ruimte || null,
    begin_datum: r.beginDatum,
    eind_datum: r.eindDatum,
    toegang_start: r.toegangStart,
    activiteit_start: r.activiteitStart,
    activiteit_eind: r.activiteitEind,
    toegang_eind: r.toegangEind,
    bron: r.bron,
    status: "wacht" as const,
  }));

  const { error } = await supabase.from("reservations").insert(rows);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/reservaties");
  return { ok: true };
}

export async function deleteReservation(id: string) {
  const supabase = await createClient();
  await supabase.from("reservations").delete().eq("id", id);
  revalidatePath("/reservaties");
}
