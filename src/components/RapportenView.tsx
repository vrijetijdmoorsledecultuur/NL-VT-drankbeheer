"use client";

import { useState, useTransition } from "react";
import { Printer, FileSpreadsheet, FileDown } from "lucide-react";
import type { Building } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { exportCsv, exportExcel } from "@/lib/export";
import {
  genereerVerbruikRapport,
  genereerLedgerRapport,
  type VerbruikRapportRegel,
  type LedgerRapportRegel,
} from "@/app/(app)/rapporten/actions";

type RapportType = "verbruik" | "ledger";

function eersteDagVanMaand() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default function RapportenView({ buildings }: { buildings: Building[] }) {
  const [rapportType, setRapportType] = useState<RapportType>("verbruik");
  const [buildingId, setBuildingId] = useState("alle");
  const [vanDatum, setVanDatum] = useState(eersteDagVanMaand());
  const [totDatum, setTotDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [verbruikRows, setVerbruikRows] = useState<VerbruikRapportRegel[] | null>(null);
  const [ledgerRows, setLedgerRows] = useState<LedgerRapportRegel[] | null>(null);
  const [pending, startTransition] = useTransition();

  const gebouwLabel = buildingId === "alle" ? "Alle gebouwen" : buildings.find((b) => b.id === buildingId)?.name || "";

  function genereer() {
    startTransition(async () => {
      if (rapportType === "verbruik") {
        const rows = await genereerVerbruikRapport(buildingId, vanDatum, totDatum);
        setVerbruikRows(rows);
        setLedgerRows(null);
      } else {
        const rows = await genereerLedgerRapport(buildingId, vanDatum, totDatum);
        setLedgerRows(rows);
        setVerbruikRows(null);
      }
    });
  }

  function csv() {
    if (rapportType === "verbruik" && verbruikRows) {
      exportCsv(
        `verbruiksrapport_${vanDatum}_${totDatum}`,
        ["Datum", "Gebouw", "Huurder", "Activiteit", "Drank", "Boetes", "Totaal"],
        verbruikRows.map((r) => [
          formatDate(r.datum),
          r.gebouw,
          r.huurder,
          r.activiteit,
          r.drankTotaal.toFixed(2),
          r.boetesTotaal.toFixed(2),
          r.totaal.toFixed(2),
        ])
      );
    } else if (ledgerRows) {
      exportCsv(
        `voorraadbewegingen_${vanDatum}_${totDatum}`,
        ["Datum", "Gebouw", "Type", "Product", "Aantal", "Wie / toelichting"],
        ledgerRows.map((r) => [formatDate(r.datum), r.gebouw, r.type, r.product, r.aantal, r.wie])
      );
    }
  }

  function excel() {
    if (rapportType === "verbruik" && verbruikRows) {
      exportExcel(
        `verbruiksrapport_${vanDatum}_${totDatum}`,
        ["Datum", "Gebouw", "Huurder", "Activiteit", "Drank", "Boetes", "Totaal"],
        verbruikRows.map((r) => [
          formatDate(r.datum),
          r.gebouw,
          r.huurder,
          r.activiteit,
          r.drankTotaal,
          r.boetesTotaal,
          r.totaal,
        ])
      );
    } else if (ledgerRows) {
      exportExcel(
        `voorraadbewegingen_${vanDatum}_${totDatum}`,
        ["Datum", "Gebouw", "Type", "Product", "Aantal", "Wie / toelichting"],
        ledgerRows.map((r) => [formatDate(r.datum), r.gebouw, r.type, r.product, r.aantal, r.wie])
      );
    }
  }

  const heeftResultaat = (verbruikRows && verbruikRows.length > 0) || (ledgerRows && ledgerRows.length > 0);
  const verbruikTotaal = verbruikRows?.reduce((s, r) => s + r.totaal, 0) ?? 0;

  return (
    <div>
      <div className="print:mb-4">
        <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Rapportagecentrum</h1>
        <p className="text-[#8A8FA8] text-sm mb-6 print:hidden">
          Stel een periode en gebouw samen en exporteer als CSV, Excel of PDF.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6 print:hidden">
        <div className="grid sm:grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setRapportType("verbruik")}
            className={`py-2.5 rounded-lg text-sm font-semibold border ${
              rapportType === "verbruik" ? "bg-[#6D5AE6] text-white border-[#6D5AE6]" : "bg-white text-[#171A2B] border-[#ECECF3]"
            }`}
          >
            Verbruik per reservatie
          </button>
          <button
            onClick={() => setRapportType("ledger")}
            className={`py-2.5 rounded-lg text-sm font-semibold border ${
              rapportType === "ledger" ? "bg-[#6D5AE6] text-white border-[#6D5AE6]" : "bg-white text-[#171A2B] border-[#ECECF3]"
            }`}
          >
            Leveringen, eigen verbruik & verplaatsingen
          </button>
        </div>

        <div className="grid sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Gebouw</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            >
              <option value="alle">Alle gebouwen</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Vanaf</label>
            <input
              type="date"
              value={vanDatum}
              onChange={(e) => setVanDatum(e.target.value)}
              className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Tot en met</label>
            <input
              type="date"
              value={totDatum}
              onChange={(e) => setTotDatum(e.target.value)}
              className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={genereer}
              disabled={pending}
              className="w-full py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Bezig\u2026" : "Genereren"}
            </button>
          </div>
        </div>
      </div>

      {(verbruikRows || ledgerRows) && (
        <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#ECECF3] flex items-center justify-between print:border-none">
            <div>
              <div className="font-bold text-[#171A2B]">
                {rapportType === "verbruik" ? "Verbruik per reservatie" : "Leveringen, eigen verbruik & verplaatsingen"}
              </div>
              <div className="text-xs text-[#8A8FA8]">
                {gebouwLabel} &middot; {formatDate(vanDatum)} &mdash; {formatDate(totDatum)}
              </div>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <button onClick={csv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ECECF3] text-xs font-semibold text-[#171A2B] hover:bg-[#F7F7FB]">
                <FileDown size={13} /> CSV
              </button>
              <button onClick={excel} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ECECF3] text-xs font-semibold text-[#171A2B] hover:bg-[#F7F7FB]">
                <FileSpreadsheet size={13} /> Excel
              </button>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ECECF3] text-xs font-semibold text-[#171A2B] hover:bg-[#F7F7FB]">
                <Printer size={13} /> Afdrukken / PDF
              </button>
            </div>
          </div>

          {!heeftResultaat && (
            <div className="px-5 py-8 text-sm text-[#B0B4CC] text-center">Geen resultaten voor deze selectie.</div>
          )}

          {rapportType === "verbruik" && verbruikRows && verbruikRows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase print:bg-transparent">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Datum</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Gebouw</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Huurder</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Activiteit</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Drank</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Boetes</th>
                  <th className="text-right px-5 py-2.5 font-semibold">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {verbruikRows.map((r, i) => (
                  <tr key={i} className="border-t border-[#ECECF3]">
                    <td className="px-5 py-2.5 text-[#5B5F82]">{formatDate(r.datum)}</td>
                    <td className="px-3 py-2.5 text-[#5B5F82]">{r.gebouw}</td>
                    <td className="px-3 py-2.5 font-medium text-[#171A2B]">{r.huurder}</td>
                    <td className="px-3 py-2.5 text-[#5B5F82]">{r.activiteit || "—"}</td>
                    <td className="px-3 py-2.5 text-right text-[#5B5F82]">&euro;{r.drankTotaal.toFixed(2)}</td>
                    <td className="px-3 py-2.5 text-right text-[#5B5F82]">&euro;{r.boetesTotaal.toFixed(2)}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-[#171A2B]">&euro;{r.totaal.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#ECECF3]">
                  <td colSpan={6} className="px-5 py-3 text-right font-semibold text-[#171A2B]">
                    Totaal
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-[#171A2B]">&euro;{verbruikTotaal.toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {rapportType === "ledger" && ledgerRows && ledgerRows.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase print:bg-transparent">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Datum</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Gebouw</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Product</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Aantal</th>
                  <th className="text-left px-5 py-2.5 font-semibold">Wie / toelichting</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((r, i) => (
                  <tr key={i} className="border-t border-[#ECECF3]">
                    <td className="px-5 py-2.5 text-[#5B5F82]">{formatDate(r.datum)}</td>
                    <td className="px-3 py-2.5 text-[#5B5F82]">{r.gebouw}</td>
                    <td className="px-3 py-2.5 text-[#171A2B]">{r.type}</td>
                    <td className="px-3 py-2.5 font-medium text-[#171A2B]">{r.product}</td>
                    <td className="px-3 py-2.5 text-right text-[#5B5F82]">{r.aantal}</td>
                    <td className="px-5 py-2.5 text-[#5B5F82]">{r.wie || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
