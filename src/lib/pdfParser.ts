import { getDocumentProxy } from "unpdf";

export type ParsedReservation = {
  gebouwNaam: string; // uit de titel van de PDF, bv. "GC De Bunder"
  huurder: string;
  adres: string;
  telefoon: string;
  activiteit: string;
  ruimte: string; // "Plaats" / "Kleedkamer", eventueel meerdere ruimtes samengevoegd
  beginDatum: string; // YYYY-MM-DD
  eindDatum: string; // YYYY-MM-DD
  toegangStart: string | null; // HH:MM
  activiteitStart: string | null; // HH:MM
  activiteitEind: string | null; // HH:MM
  toegangEind: string | null; // HH:MM
};

type Item = { x: number; y: number; text: string };

// Kolomgrenzen, afgeleid uit de vaste rapportopmaak van de gemeentelijke reservatietool
// (Cultuurdienst Moorslede — "RESERVERINGSOVERZICHT VAN ..."). Elke waarde is de
// bovengrens (exclusief) van de kolom die eronder begint.
const COLUMNS = [
  { key: "beginDatum", max: 95 },
  { key: "startuur", max: 142 },
  { key: "reservatieStart", max: 188 },
  { key: "reservatieEind", max: 233 },
  { key: "eindUur", max: 278 },
  { key: "eindDatum", max: 333 },
  { key: "plaats", max: 430 },
  { key: "klant", max: 565 },
  { key: "activiteit", max: 685 },
  { key: "adres", max: 750 },
  { key: "telefoon", max: Infinity },
] as const;

function columnFor(x: number): string {
  for (const c of COLUMNS) {
    if (x < c.max) return c.key;
  }
  return "telefoon";
}

const TIME_RE = /^\d{1,2}:\d{2}$/;
const DATE_RE = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;

function toIsoDate(match: RegExpMatchArray, fallbackYear?: string): string {
  const [, d, m, y] = match;
  const year = y || fallbackYear || String(new Date().getFullYear());
  return `${year.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export async function parseReservationsPdf(buffer: Buffer): Promise<{
  gebouwNaam: string;
  reservations: ParsedReservation[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const doc = await getDocumentProxy(new Uint8Array(buffer));

  let gebouwNaam = "";
  const rowsRaw: { y: number; items: Item[] }[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const items: Item[] = content.items
      .map((it) => {
        const anyIt = it as unknown as { str: string; transform: number[] };
        return { x: anyIt.transform[4], y: anyIt.transform[5], text: anyIt.str };
      })
      .filter((it) => it.text.trim() !== "");

    for (const it of items) {
      if (it.text.startsWith("RESERVERINGSOVERZICHT VAN") && !gebouwNaam) {
        // De gebouwnaam staat vlak na deze titel, op dezelfde regel, vóór de
        // "Van :"/"Tot :"-datumkolom die verderop op diezelfde hoogte begint (~x 534).
        const sameLine = items
          .filter((o) => Math.abs(o.y - it.y) < 0.5 && o.x > it.x && o.x < 500)
          .sort((a, b) => a.x - b.x);
        gebouwNaam = sameLine.map((o) => o.text).join(" ").trim();
      }
    }

    // Groepeer items in regels op basis van y-positie, per pagina (elke pagina heeft
    // zijn eigen coördinatensysteem, dus niet over paginagrenzen heen combineren).
    const pageRows: { y: number; items: Item[] }[] = [];
    for (const it of items) {
      let row = pageRows.find((r) => Math.abs(r.y - it.y) < 1.5);
      if (!row) {
        row = { y: it.y, items: [] };
        pageRows.push(row);
      }
      row.items.push(it);
    }
    pageRows.sort((a, b) => b.y - a.y);
    rowsRaw.push(...pageRows);
  }

  const parsed: ParsedReservation[] = [];
  let lastBeginDatum: string | null = null;
  let currentYear = new Date().getFullYear().toString();

  for (const row of rowsRaw) {
    const byCol: Record<string, Item[]> = {};
    for (const it of row.items) {
      const col = columnFor(it.x);
      (byCol[col] ||= []).push(it);
    }
    const text = (col: string) =>
      (byCol[col] || []).sort((a, b) => a.x - b.x).map((i) => i.text).join(" ").trim();

    const startuur = text("startuur");
    const reservatieStart = text("reservatieStart");
    const reservatieEind = text("reservatieEind");
    const eindUur = text("eindUur");

    // Enkel rijen die minstens één herkenbaar tijdstip bevatten zijn echte data-rijen.
    const isDataRow = [startuur, reservatieStart, reservatieEind, eindUur].some((t) => TIME_RE.test(t));
    if (!isDataRow) continue;

    const beginDatumText = text("beginDatum");
    const dateMatch = beginDatumText.match(DATE_RE);
    let beginDatum: string;
    if (dateMatch) {
      beginDatum = toIsoDate(dateMatch);
      currentYear = dateMatch[3];
      lastBeginDatum = beginDatum;
    } else if (lastBeginDatum) {
      // Vervolgregel (zelfde datum, andere ruimte) — Begin Datum staat niet herhaald in de PDF.
      beginDatum = lastBeginDatum;
    } else {
      warnings.push(`Rij zonder herkenbare begindatum overgeslagen (tekst: "${beginDatumText}").`);
      continue;
    }

    const eindDatumText = text("eindDatum");
    const eindDateMatch = eindDatumText.match(DATE_RE);
    const eindDatum = eindDateMatch ? toIsoDate(eindDateMatch, currentYear) : beginDatum;

    parsed.push({
      gebouwNaam,
      huurder: text("klant"),
      adres: text("adres"),
      telefoon: text("telefoon"),
      activiteit: text("activiteit"),
      ruimte: text("plaats"),
      beginDatum,
      eindDatum,
      toegangStart: TIME_RE.test(startuur) ? startuur : null,
      activiteitStart: TIME_RE.test(reservatieStart) ? reservatieStart : null,
      activiteitEind: TIME_RE.test(reservatieEind) ? reservatieEind : null,
      toegangEind: TIME_RE.test(eindUur) ? eindUur : null,
    });
  }

  // Meerdere rijen voor dezelfde boeking (één per ruimte/zaal) samenvoegen tot één reservatie.
  const grouped = new Map<string, ParsedReservation>();
  for (const r of parsed) {
    const key = [r.beginDatum, r.eindDatum, r.toegangStart, r.activiteitStart, r.activiteitEind, r.toegangEind, r.huurder, r.activiteit].join("|");
    const existing = grouped.get(key);
    if (existing) {
      if (r.ruimte && !existing.ruimte.split(", ").includes(r.ruimte)) {
        existing.ruimte = existing.ruimte ? `${existing.ruimte}, ${r.ruimte}` : r.ruimte;
      }
    } else {
      grouped.set(key, { ...r });
    }
  }

  if (!gebouwNaam) {
    warnings.push("Kon de gebouwnaam niet uit de titel van de PDF halen — kies het gebouw manueel.");
  }

  return { gebouwNaam, reservations: Array.from(grouped.values()), warnings };
}

// Best-effort matching van de gebouwnaam uit de PDF met een gebouw uit de database.
export function matchBuilding(pdfName: string, buildings: { id: string; name: string }[]): string | null {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/^(gc|jc|oc)\b\.?\s*/i, "")
      .replace(/['’\-.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const target = normalize(pdfName);
  if (!target) return null;

  let best: { id: string; score: number } | null = null;
  for (const b of buildings) {
    const candidate = normalize(b.name);
    if (candidate === target) return b.id;
    const targetWords = new Set(target.split(" "));
    const candidateWords = candidate.split(" ");
    const overlap = candidateWords.filter((w) => targetWords.has(w)).length;
    const score = overlap / Math.max(candidateWords.length, targetWords.size);
    if (score > 0 && (!best || score > best.score)) best = { id: b.id, score };
  }
  return best && best.score >= 0.5 ? best.id : null;
}
