"use server";

import { createClient } from "@/lib/supabase/server";

export type TellerGebouw = { id: string; name: string };
export type TellerTelplek = {
  id: string;
  naam: string;
  volgorde: number;
  heeft_vaste_voorraad: boolean;
  vereist_naam: string | null;
};
export type TellerProduct = { id: string; name: string; categorie: string; standaard: boolean };
export type TellerVasteVoorraadRegel = { product_id: string; name: string; aantal: number };
export type TellerReservation = {
  id: string;
  huurder: string;
  activiteit: string | null;
  ruimte: string | null;
  begin_datum: string;
  eind_datum: string;
};

export async function getGebouwen(token: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("teller_gebouwen", { p_token: token });
  return (data as TellerGebouw[]) || [];
}

export async function getTelplekken(token: string, buildingId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("teller_telplekken", { p_token: token, p_building_id: buildingId });
  return (data as TellerTelplek[]) || [];
}

export async function getTelplekProducten(token: string, telplekId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("teller_telplek_producten", { p_token: token, p_telplek_id: telplekId });
  return (data as TellerProduct[]) || [];
}

export async function getVasteVoorraad(token: string, telplekId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("teller_vaste_voorraad", { p_token: token, p_telplek_id: telplekId });
  return (data as TellerVasteVoorraadRegel[]) || [];
}

export async function getReservaties(token: string, buildingId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("teller_reservaties", { p_token: token, p_building_id: buildingId });
  return (data as TellerReservation[]) || [];
}

export async function getVoorafReferentie(token: string, reservationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("teller_vooraf_referentie", {
    p_token: token,
    p_reservation_id: reservationId,
  });
  if (error) return {};
  const map: Record<string, number> = {};
  for (const row of (data as { product_id: string; vooraf_aantal: number }[]) || []) {
    map[row.product_id] = row.vooraf_aantal;
  }
  return map;
}

export async function submitTelling(
  token: string,
  input: {
    buildingId: string;
    telplekId: string;
    reservationId: string | null;
    type: "vooraf" | "nadien" | "controle";
    ingevoerdDoor: string;
    regels: { productId: string; aantal: number }[];
    afwijkingBevestigd: boolean;
    vasteVoorraadBevestigd: boolean;
  }
) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_ruwe_telling", {
    p_token: token,
    p_building_id: input.buildingId,
    p_telplek_id: input.telplekId,
    p_reservation_id: input.reservationId,
    p_type: input.type,
    p_ingevoerd_door: input.ingevoerdDoor,
    p_regels: input.regels.map((r) => ({ product_id: r.productId, aantal: r.aantal })),
    p_afwijking_bevestigd: input.afwijkingBevestigd,
    p_vaste_voorraad_bevestigd: input.vasteVoorraadBevestigd,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}
