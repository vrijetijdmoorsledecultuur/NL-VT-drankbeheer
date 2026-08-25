"use server";

import { createClient } from "@/lib/supabase/server";
import type { Building, Reservation, Product, Telling, VerbruikRegel } from "@/lib/types";
import { computeVerbruik, computeTotaal } from "@/lib/verbruik";

export type VerbruikRapportRegel = {
  datum: string;
  gebouw: string;
  huurder: string;
  activiteit: string;
  drankTotaal: number;
  boetesTotaal: number;
  totaal: number;
};

export type LedgerRapportRegel = {
  datum: string;
  gebouw: string;
  type: "Levering" | "Eigen verbruik" | "Verplaatsing (uit)" | "Verplaatsing (in)";
  product: string;
  aantal: number;
  wie: string;
};

export async function genereerVerbruikRapport(
  buildingId: string,
  vanDatum: string,
  totDatum: string
): Promise<VerbruikRapportRegel[]> {
  const supabase = await createClient();

  let query = supabase
    .from("reservations")
    .select("id, building_id, huurder, activiteit, begin_datum, eind_datum")
    .gte("begin_datum", vanDatum)
    .lte("begin_datum", totDatum);
  if (buildingId !== "alle") query = query.eq("building_id", buildingId);
  const { data: reservations } = await query;

  if (!reservations || reservations.length === 0) return [];

  const [{ data: buildings }, { data: products }, { data: tellingen }, { data: leveringen }, { data: eigenVerbruik }, { data: boetes }] =
    await Promise.all([
      supabase.from("buildings").select("id, name, actief"),
      supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus"),
      supabase.from("reservation_product_tellingen").select("reservation_id, product_id, vooraf, nadien"),
      supabase.from("leveringen").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
      supabase.from("eigen_verbruik").select("id, reservation_id, building_id, datum, product_id, aantal, wie"),
      supabase.from("reservation_boetes").select("reservation_id, product_id"),
    ]);

  const buildingList = (buildings as Building[]) || [];
  const productList = (products as Product[]) || [];
  const reservationList = reservations as Reservation[];
  const tellingList = (tellingen as Telling[]) || [];
  const leveringList = (leveringen as VerbruikRegel[]) || [];
  const eigenList = (eigenVerbruik as VerbruikRegel[]) || [];
  const boeteList = (boetes as { reservation_id: string; product_id: string }[]) || [];

  const rows: VerbruikRapportRegel[] = [];
  for (const r of reservationList) {
    const gebouwNaam = buildingList.find((b) => b.id === r.building_id)?.name || "?";
    const { perProduct } = computeVerbruik(r, reservationList, tellingList, leveringList, eigenList, productList);
    const boeteProductIds = boeteList.filter((b) => b.reservation_id === r.id).map((b) => b.product_id);
    const { drankTotaal, boetesTotaal, totaal } = computeTotaal(perProduct, productList, boeteProductIds);

    rows.push({
      datum: r.begin_datum,
      gebouw: gebouwNaam,
      huurder: r.huurder,
      activiteit: r.activiteit || "",
      drankTotaal,
      boetesTotaal,
      totaal,
    });
  }

  return rows.sort((a, b) => a.datum.localeCompare(b.datum));
}

export async function genereerLedgerRapport(
  buildingId: string,
  vanDatum: string,
  totDatum: string
): Promise<LedgerRapportRegel[]> {
  const supabase = await createClient();

  const [{ data: buildings }, { data: products }] = await Promise.all([
    supabase.from("buildings").select("id, name, actief"),
    supabase.from("products").select("id, name, prijs, categorie, verpakking, actief, afrekenmodus"),
  ]);
  const buildingList = (buildings as Building[]) || [];
  const productList = (products as Product[]) || [];
  const gebouwNaam = (id: string) => buildingList.find((b) => b.id === id)?.name || "?";
  const productNaam = (id: string) => productList.find((p) => p.id === id)?.name || "?";

  let leveringenQuery = supabase
    .from("leveringen")
    .select("id, building_id, datum, product_id, aantal, wie")
    .is("reservation_id", null)
    .gte("datum", vanDatum)
    .lte("datum", totDatum);
  let eigenQuery = supabase
    .from("eigen_verbruik")
    .select("id, building_id, datum, product_id, aantal, wie")
    .is("reservation_id", null)
    .gte("datum", vanDatum)
    .lte("datum", totDatum);
  if (buildingId !== "alle") {
    leveringenQuery = leveringenQuery.eq("building_id", buildingId);
    eigenQuery = eigenQuery.eq("building_id", buildingId);
  }

  let verplaatsingenQuery = supabase
    .from("voorraadverplaatsingen")
    .select("id, van_building_id, naar_building_id, datum, product_id, aantal, wie")
    .gte("datum", vanDatum)
    .lte("datum", totDatum);
  if (buildingId !== "alle") {
    verplaatsingenQuery = verplaatsingenQuery.or(`van_building_id.eq.${buildingId},naar_building_id.eq.${buildingId}`);
  }

  const [{ data: leveringen }, { data: eigenVerbruik }, { data: verplaatsingen }] = await Promise.all([
    leveringenQuery,
    eigenQuery,
    verplaatsingenQuery,
  ]);

  const rows: LedgerRapportRegel[] = [];

  for (const l of (leveringen as { building_id: string; datum: string; product_id: string; aantal: number; wie: string | null }[]) || []) {
    rows.push({
      datum: l.datum,
      gebouw: gebouwNaam(l.building_id),
      type: "Levering",
      product: productNaam(l.product_id),
      aantal: l.aantal,
      wie: l.wie || "",
    });
  }
  for (const e of (eigenVerbruik as { building_id: string; datum: string; product_id: string; aantal: number; wie: string | null }[]) || []) {
    rows.push({
      datum: e.datum,
      gebouw: gebouwNaam(e.building_id),
      type: "Eigen verbruik",
      product: productNaam(e.product_id),
      aantal: e.aantal,
      wie: e.wie || "",
    });
  }
  for (const v of (verplaatsingen as {
    van_building_id: string;
    naar_building_id: string;
    datum: string;
    product_id: string;
    aantal: number;
    wie: string | null;
  }[]) || []) {
    if (buildingId === "alle" || v.van_building_id === buildingId) {
      rows.push({
        datum: v.datum,
        gebouw: gebouwNaam(v.van_building_id),
        type: "Verplaatsing (uit)",
        product: productNaam(v.product_id),
        aantal: v.aantal,
        wie: `naar ${gebouwNaam(v.naar_building_id)}${v.wie ? " · " + v.wie : ""}`,
      });
    }
    if (buildingId === "alle" || v.naar_building_id === buildingId) {
      rows.push({
        datum: v.datum,
        gebouw: gebouwNaam(v.naar_building_id),
        type: "Verplaatsing (in)",
        product: productNaam(v.product_id),
        aantal: v.aantal,
        wie: `van ${gebouwNaam(v.van_building_id)}${v.wie ? " · " + v.wie : ""}`,
      });
    }
  }

  return rows.sort((a, b) => a.datum.localeCompare(b.datum));
}
