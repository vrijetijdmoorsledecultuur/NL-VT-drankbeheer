"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RuweTelling, RuweTellingRegel, Product, Building, Reservation, Telplek } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/format";

export function genereerTellingPdf(
  telling: RuweTelling,
  regels: RuweTellingRegel[],
  products: Product[],
  gebouwNaam: string,
  reservation: Reservation | null,
  telplekNaam: string | null
) {
  const doc = new jsPDF();

  const typeLabel = telling.type === "vooraf" ? "Voorafcontrole" : telling.type === "nadien" ? "Nacontrole" : "Controletelling";

  doc.setFontSize(16);
  doc.text(typeLabel, 14, 18);

  doc.setFontSize(10);
  let y = 28;
  doc.text(`Gebouw: ${gebouwNaam}`, 14, y);
  y += 6;
  if (telplekNaam) {
    doc.text(`Telplek: ${telplekNaam}`, 14, y);
    y += 6;
  }
  if (reservation) {
    doc.text(`Reservatie: ${reservation.huurder}${reservation.activiteit ? ` (${reservation.activiteit})` : ""}`, 14, y);
    y += 6;
    doc.text(`Datum activiteit: ${formatDate(reservation.begin_datum)}`, 14, y);
    y += 6;
  } else {
    doc.text("Los van een reservatie", 14, y);
    y += 6;
  }
  if (telling.ingevoerd_door) {
    doc.text(`Geteld door: ${telling.ingevoerd_door}`, 14, y);
    y += 6;
  }
  doc.text(`Goedgekeurd op: ${formatDateTime(new Date().toISOString())}`, 14, y);
  y += 4;

  const rows = regels.map((r) => {
    const product = products.find((p) => p.id === r.product_id);
    return [product?.name || "?", String(r.aantal)];
  });

  autoTable(doc, {
    startY: y + 4,
    head: [["Product", "Aantal"]],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [109, 90, 230] },
  });

  const naamDeel = (reservation?.huurder || "controletelling").replace(/[^a-z0-9]/gi, "_");
  doc.save(`telling-${naamDeel}-${new Date().toISOString().slice(0, 10)}.pdf`);
}
