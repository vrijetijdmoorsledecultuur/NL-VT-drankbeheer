"use client";

import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import type { Building, Reservation, LogboekRegel } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const ACTIE_LABELS: Record<string, { label: string; tone: string }> = {
  levering: { label: "Levering", tone: "bg-[#E4F6EE] text-[#1B8E63]" },
  eigen_verbruik: { label: "Eigen verbruik", tone: "bg-[#FDF1DE] text-[#B4790C]" },
  levering_verwijderd: { label: "Levering verwijderd", tone: "bg-[#FDECEC] text-[#B03A30]" },
  eigen_verbruik_verwijderd: { label: "Eigen verbruik verwijderd", tone: "bg-[#FDECEC] text-[#B03A30]" },
  boete_aangevinkt: { label: "Boete aangevinkt", tone: "bg-[#FDECEC] text-[#B03A30]" },
  boete_afgevinkt: { label: "Boete afgevinkt", tone: "bg-[#F1F1F6] text-[#6B7094]" },
  toegangscode_gepland: { label: "Toegangscode gepland", tone: "bg-[#E7F0FD] text-[#2F6FCB]" },
  toegangscode_verstuurd: { label: "Toegangscode verstuurd", tone: "bg-[#E7F0FD] text-[#2F6FCB]" },
  toegangscode_verwijderd: { label: "Toegangscode verwijderd", tone: "bg-[#F1F1F6] text-[#6B7094]" },
  telling_goedgekeurd: { label: "Telling goedgekeurd", tone: "bg-[#E4F6EE] text-[#1B8E63]" },
  telling_genegeerd: { label: "Telling genegeerd", tone: "bg-[#F1F1F6] text-[#6B7094]" },
  reservatie_afgerond: { label: "Reservatie afgerond", tone: "bg-[#E4F6EE] text-[#1B8E63]" },
  reservatie_verwijderd: { label: "Reservatie verwijderd", tone: "bg-[#FDECEC] text-[#B03A30]" },
  contact_verwijderd: { label: "Contact verwijderd", tone: "bg-[#FDECEC] text-[#B03A30]" },
  verplaatsing: { label: "Verplaatsing", tone: "bg-[#EFEBFF] text-[#6D5AE6]" },
  bestelling_aangemaakt: { label: "Bestelling aangemaakt", tone: "bg-[#E7F0FD] text-[#2F6FCB]" },
  bestelling_verstuurd: { label: "Bestelling verstuurd", tone: "bg-[#E7F0FD] text-[#2F6FCB]" },
  bestelling_geannuleerd: { label: "Bestelling geannuleerd", tone: "bg-[#FDECEC] text-[#B03A30]" },
  levering_bevestigd: { label: "Levering bevestigd", tone: "bg-[#E4F6EE] text-[#1B8E63]" },
};

export default function LogboekView({
  regels,
  buildings,
  reservations,
}: {
  regels: LogboekRegel[];
  buildings: Building[];
  reservations: Reservation[];
}) {
  const [buildingFilter, setBuildingFilter] = useState("alle");
  const [actieFilter, setActieFilter] = useState("alle");
  const [zoek, setZoek] = useState("");
  const gebruikers = useMemo(() => Array.from(new Set(regels.map((r) => r.gebruiker_naam).filter(Boolean))), [regels]);
  const [gebruikerFilter, setGebruikerFilter] = useState("alle");

  const gefilterd = useMemo(() => {
    return regels.filter((r) => {
      if (buildingFilter !== "alle" && r.building_id !== buildingFilter) return false;
      if (actieFilter !== "alle" && r.actie !== actieFilter) return false;
      if (gebruikerFilter !== "alle" && r.gebruiker_naam !== gebruikerFilter) return false;
      if (zoek && !r.omschrijving.toLowerCase().includes(zoek.toLowerCase())) return false;
      return true;
    });
  }, [regels, buildingFilter, actieFilter, gebruikerFilter, zoek]);

  function gebouwNaam(id: string | null) {
    return id ? buildings.find((b) => b.id === id)?.name : null;
  }
  function reservatieNaam(id: string | null) {
    return id ? reservations.find((r) => r.id === id)?.huurder : null;
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-xl bg-[#EFEBFF] text-[#6D5AE6] flex items-center justify-center shrink-0">
          <ScrollText size={17} />
        </div>
        <h1 className="text-2xl font-bold text-[#171A2B]">Logboek</h1>
      </div>
      <p className="text-[#8A8FA8] text-sm mb-6">Wie deed wat, wanneer — de laatste 300 acties.</p>

      <div className="bg-white rounded-2xl border border-[#ECECF3] p-4 mb-4 flex flex-wrap gap-2">
        <select value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)} className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
          <option value="alle">Alle gebouwen</option>
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select value={actieFilter} onChange={(e) => setActieFilter(e.target.value)} className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
          <option value="alle">Alle acties</option>
          {Object.entries(ACTIE_LABELS).map(([key, { label }]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select value={gebruikerFilter} onChange={(e) => setGebruikerFilter(e.target.value)} className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
          <option value="alle">Alle medewerkers</option>
          {gebruikers.map((g) => (
            <option key={g} value={g!}>
              {g}
            </option>
          ))}
        </select>
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek in omschrijving..."
          className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm flex-1 min-w-[160px]"
        />
      </div>

      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
        {gefilterd.length === 0 && <div className="px-5 py-6 text-sm text-[#B0B4CC]">Geen resultaten voor deze selectie.</div>}
        <div className="divide-y divide-[#ECECF3]">
          {gefilterd.map((r) => {
            const info = ACTIE_LABELS[r.actie] || { label: r.actie, tone: "bg-[#F1F1F6] text-[#6B7094]" };
            const context = [gebouwNaam(r.building_id), reservatieNaam(r.reservation_id)].filter(Boolean).join(" · ");
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${info.tone}`}>
                      {info.label}
                    </span>
                    <span className="text-sm font-medium text-[#171A2B]">{r.omschrijving}</span>
                  </div>
                  <div className="text-xs text-[#8A8FA8] mt-1">
                    {r.gebruiker_naam || "Onbekend"}
                    {context ? ` · ${context}` : ""}
                  </div>
                </div>
                <div className="text-xs text-[#B0B4CC] whitespace-nowrap shrink-0">{formatDateTime(r.created_at)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
