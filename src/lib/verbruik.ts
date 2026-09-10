import type { Reservation, Telling, VerbruikRegel, Product, Voorraadverplaatsing, VoorraadControletelling, ProductPrijs } from "./types";

/**
 * Zoekt de prijs die op een bepaalde datum gold, op basis van de
 * prijsgeschiedenis. Zonder geschiedenis (bv. een scherm dat ze niet meegeeft)
 * valt dit terug op de huidige prijs van het product, zodat niets breekt.
 */
export function prijsOpDatum(product: Product, datum: string | null | undefined, prijzen: ProductPrijs[]): number {
  if (!datum) return product.prijs;
  const geschiedenis = prijzen
    .filter((p) => p.product_id === product.id && p.geldig_vanaf <= datum)
    .sort((a, b) => b.geldig_vanaf.localeCompare(a.geldig_vanaf));
  return geschiedenis[0]?.prijs ?? product.prijs;
}

// Zoekt de nadien-telling van de meest recente andere reservatie in hetzelfde
// gebouw, vóór deze reservatie, als vervangende vooraf-waarde wanneer er zelf
// geen vooraf-telling is (bv. poetspersoneel afwezig).
export function findFallbackVooraf(
  reservation: Reservation,
  allReservations: Reservation[],
  allTellingen: Telling[],
  productId: string
): number | null {
  const candidates = allReservations
    .filter((r) => r.building_id === reservation.building_id && r.id !== reservation.id)
    .filter((r) => {
      const key = (r.begin_datum || "") + "T" + (r.toegang_start || "00:00");
      const thisKey = (reservation.begin_datum || "") + "T" + (reservation.toegang_start || "00:00");
      return key < thisKey;
    })
    .sort((a, b) => {
      const ka = (a.begin_datum || "") + "T" + (a.toegang_start || "00:00");
      const kb = (b.begin_datum || "") + "T" + (b.toegang_start || "00:00");
      return kb.localeCompare(ka);
    });

  for (const cand of candidates) {
    const t = allTellingen.find((x) => x.reservation_id === cand.id && x.product_id === productId);
    if (t && t.nadien != null) return t.nadien;
  }
  return null;
}

export function computeVerbruik(
  reservation: Reservation,
  allReservations: Reservation[],
  allTellingen: Telling[],
  leveringen: VerbruikRegel[],
  eigenVerbruik: VerbruikRegel[],
  products: Product[]
): { perProduct: Record<string, number | null>; usedFallback: Record<string, boolean> } {
  const perProduct: Record<string, number | null> = {};
  const usedFallback: Record<string, boolean> = {};

  for (const p of products) {
    const t = allTellingen.find((x) => x.reservation_id === reservation.id && x.product_id === p.id);
    let vooraf = t?.vooraf ?? null;
    let fallback = false;
    if (vooraf == null) {
      const fb = findFallbackVooraf(reservation, allReservations, allTellingen, p.id);
      if (fb != null) {
        vooraf = fb;
        fallback = true;
      }
    }
    const nadien = t?.nadien ?? null;

    if (vooraf == null || nadien == null) {
      perProduct[p.id] = null;
      usedFallback[p.id] = fallback;
      continue;
    }

    const geleverd = leveringen
      .filter((l) => l.reservation_id === reservation.id && l.product_id === p.id)
      .reduce((s, l) => s + l.aantal, 0);
    const eigen = eigenVerbruik
      .filter((l) => l.reservation_id === reservation.id && l.product_id === p.id)
      .reduce((s, l) => s + l.aantal, 0);

    perProduct[p.id] = vooraf - nadien + geleverd - eigen;
    usedFallback[p.id] = fallback;
  }

  return { perProduct, usedFallback };
}

export function computeTotaal(
  perProduct: Record<string, number | null>,
  products: Product[],
  boeteProductIds: string[],
  datum?: string | null,
  prijzen: ProductPrijs[] = []
): { drankTotaal: number; boetesTotaal: number; totaal: number } {
  const drankTotaal = products.reduce((sum, p) => {
    const q = perProduct[p.id];
    return q != null ? sum + q * prijsOpDatum(p, datum, prijzen) : sum;
  }, 0);
  const boetesTotaal = products
    .filter((p) => boeteProductIds.includes(p.id))
    .reduce((sum, p) => sum + prijsOpDatum(p, datum, prijzen), 0);
  return { drankTotaal, boetesTotaal, totaal: drankTotaal + boetesTotaal };
}

export type VoorraadResultaat = {
  stuks: number | null;
  ijkpuntDatum: string | null;
};

/**
 * Berekent de actuele (live) voorraad van een product in een gebouw, zonder
 * een apart bij te houden getal dat uit sync kan raken. Het ijkpunt is
 * telkens de meest recente bevestigde nadien-telling in dat gebouw; alle
 * bewegingen erna (leveringen, eigen verbruik, verplaatsingen) tellen erbij
 * of eraf. Zonder ooit een nadien-telling is de voorraad "onbekend" (null) —
 * er is dan simpelweg geen betrouwbaar ijkpunt om vanuit te rekenen.
 */
export function computeVoorraad(
  buildingId: string,
  products: Product[],
  reservations: Reservation[],
  tellingen: Telling[],
  leveringen: VerbruikRegel[],
  eigenVerbruik: VerbruikRegel[],
  verplaatsingen: Voorraadverplaatsing[],
  controletellingen: VoorraadControletelling[] = []
): Record<string, VoorraadResultaat> {
  const result: Record<string, VoorraadResultaat> = {};
  const buildingReservations = reservations.filter((r) => r.building_id === buildingId);

  function effectiveDatum(row: VerbruikRegel): string | null {
    if (row.datum) return row.datum;
    if (row.reservation_id) return reservations.find((x) => x.id === row.reservation_id)?.begin_datum ?? null;
    return null;
  }
  function effectiveBuilding(row: VerbruikRegel): string | null {
    if (row.building_id) return row.building_id;
    if (row.reservation_id) return reservations.find((x) => x.id === row.reservation_id)?.building_id ?? null;
    return null;
  }

  for (const p of products) {
    let baselineDatum: string | null = null;
    let baselineStuks: number | null = null;
    for (const r of buildingReservations) {
      const t = tellingen.find((x) => x.reservation_id === r.id && x.product_id === p.id);
      if (t?.nadien == null) continue;
      if (baselineDatum === null || (r.begin_datum || "") > baselineDatum) {
        baselineDatum = r.begin_datum;
        baselineStuks = t.nadien;
      }
    }

    // Een goedgekeurde controletelling is een even geldig — vaak recenter —
    // ijkpunt dan de laatste reservatie-telling: neem de meest recente van
    // de twee.
    for (const c of controletellingen) {
      if (c.building_id !== buildingId || c.product_id !== p.id) continue;
      if (baselineDatum === null || c.datum > baselineDatum) {
        baselineDatum = c.datum;
        baselineStuks = c.aantal;
      }
    }

    if (baselineStuks === null || baselineDatum === null) {
      result[p.id] = { stuks: null, ijkpuntDatum: null };
      continue;
    }

    let stuks = baselineStuks;
    for (const l of leveringen) {
      if (l.product_id !== p.id || effectiveBuilding(l) !== buildingId) continue;
      const d = effectiveDatum(l);
      if (d && d > baselineDatum) stuks += l.aantal;
    }
    for (const e of eigenVerbruik) {
      if (e.product_id !== p.id || effectiveBuilding(e) !== buildingId) continue;
      const d = effectiveDatum(e);
      if (d && d > baselineDatum) stuks -= e.aantal;
    }
    for (const v of verplaatsingen) {
      if (v.product_id !== p.id || v.datum <= baselineDatum) continue;
      if (v.naar_building_id === buildingId) stuks += v.aantal;
      if (v.van_building_id === buildingId) stuks -= v.aantal;
    }

    result[p.id] = { stuks, ijkpuntDatum: baselineDatum };
  }

  return result;
}
