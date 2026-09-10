"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Factuur, FactuurRegel, Product, Building } from "@/lib/types";
import { formatDate } from "@/lib/format";

export function genereerFactuurPdf(
  factuur: Factuur,
  regels: FactuurRegel[],
  products: Product[],
  gebouwNaam: string
) {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(factuur.type === "factuur" ? "Factuur" : "Creditnota", 14, 18);

  doc.setFontSize(10);
  doc.text(`Gebouw: ${gebouwNaam}`, 14, 28);
  doc.text(`Naam: ${factuur.naam}`, 14, 34);
  doc.text(`Datum: ${formatDate(factuur.datum)}`, 14, 40);
  if (factuur.wie) doc.text(`Geregistreerd door: ${factuur.wie}`, 14, 46);
  doc.text(
    factuur.goedgekeurd_door ? `Goedgekeurd door: ${factuur.goedgekeurd_door}` : "Zonet goedgekeurd",
    14,
    factuur.wie ? 52 : 46
  );

  const rows = regels.map((r) => {
    const product = products.find((p) => p.id === r.product_id);
    return [product?.name || "?", String(r.aantal), `\u20ac${r.prijs.toFixed(2)}`, `\u20ac${(r.aantal * r.prijs).toFixed(2)}`];
  });

  autoTable(doc, {
    startY: factuur.wie ? 58 : 52,
    head: [["Product", "Aantal", "Prijs/stuk", "Subtotaal"]],
    body: rows,
    foot: [["", "", "Totaal", `${factuur.type === "creditnota" ? "\u2212" : ""}\u20ac${factuur.bedrag.toFixed(2)}`]],
    styles: { fontSize: 9 },
    headStyles: { fillColor: [109, 90, 230] },
  });

  doc.save(`${factuur.type}-${factuur.naam.replace(/[^a-z0-9]/gi, "_")}-${factuur.datum}.pdf`);
}
