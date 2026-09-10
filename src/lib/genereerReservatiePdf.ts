"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Reservation, Product, Telling } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function genereerReservatiePdf(
  reservation: Reservation,
  huurderNaam: string,
  gebouwNaam: string,
  drankProducten: Product[],
  tellingen: Telling[],
  perProduct: Record<string, number | null>,
  prijsPerProduct: Record<string, number>,
  boeteProducten: { name: string; prijs: number }[],
  totaal: number
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Drankafrekening", 14, 18);

  doc.setFontSize(10);
  doc.text(`Gebouw: ${gebouwNaam}`, 14, 28);
  doc.text(`Huurder: ${huurderNaam}`, 14, 34);
  doc.text(`Activiteit: ${reservation.activiteit || "—"}`, 14, 40);
  doc.text(`Datum: ${formatDate(reservation.begin_datum)}`, 14, 46);

  const rows = drankProducten
    .map((p) => {
      const t = tellingen.find((x) => x.reservation_id === reservation.id && x.product_id === p.id);
      const verbruik = perProduct[p.id];
      if (verbruik == null) return null;
      const prijs = prijsPerProduct[p.id] ?? p.prijs;
      return [p.name, String(t?.vooraf ?? "—"), String(t?.nadien ?? "—"), String(verbruik), `\u20ac${(verbruik * prijs).toFixed(2)}`];
    })
    .filter((r): r is string[] => r !== null);

  autoTable(doc, {
    startY: 52,
    head: [["Product", "Vooraf", "Nadien", "Verbruik", "Bedrag"]],
    body: rows,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [109, 90, 230] },
  });

  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  if (boeteProducten.length > 0) {
    doc.setFontSize(11);
    doc.text("Boetes en toeslagen", 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [["Omschrijving", "Bedrag"]],
      body: boeteProducten.map((b) => [b.name, `\u20ac${b.prijs.toFixed(2)}`]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [214, 73, 60] },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  doc.setFontSize(13);
  doc.text(`Totaal: \u20ac${totaal.toFixed(2)}`, 14, y);

  doc.save(`afrekening-${huurderNaam.replace(/[^a-z0-9]/gi, "_")}-${reservation.begin_datum}.pdf`);
}
