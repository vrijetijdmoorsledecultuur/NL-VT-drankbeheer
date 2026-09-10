"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import type { Building, LogboekRegel } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const ACTIE_LABELS: Record<string, string> = {
  levering: "Levering",
  eigen_verbruik: "Eigen verbruik",
  levering_verwijderd: "Levering verwijderd",
  eigen_verbruik_verwijderd: "Eigen verbruik verwijderd",
  boete_aangevinkt: "Boete aangevinkt",
  boete_afgevinkt: "Boete afgevinkt",
  toegangscode_gepland: "Toegangscode gepland",
  toegangscode_verstuurd: "Toegangscode verstuurd",
  toegangscode_verwijderd: "Toegangscode verwijderd",
  telling_goedgekeurd: "Telling goedgekeurd",
  telling_genegeerd: "Telling genegeerd",
  controletelling_goedgekeurd: "Controletelling goedgekeurd",
  reservatie_afgerond: "Reservatie afgerond",
  reservatie_verwijderd: "Reservatie verwijderd",
  reservatie_manueel_aangemaakt: "Snelle verhuring geboekt",
  contact_verwijderd: "Contact verwijderd",
  verplaatsing: "Verplaatsing",
  bestelling_aangemaakt: "Bestelling aangemaakt",
  bestelling_verstuurd: "Bestelling verstuurd",
  bestelling_geannuleerd: "Bestelling geannuleerd",
  levering_bevestigd: "Levering bevestigd",
  factuur_aangemaakt: "Factuur/creditnota",
  factuur_goedgekeurd: "Factuur goedgekeurd",
  recreatex_verwerkt: "Recreatex verwerkt",
  gebruiker_verwijderd: "Gebruiker verwijderd",
};

export default function ActiefGebouwPaneel({
  buildings,
  logboekRegels,
  reservatiesVandaag,
  openTellingen,
}: {
  buildings: Building[];
  logboekRegels: LogboekRegel[];
  reservatiesVandaag: { id: string; building_id: string }[];
  openTellingen: { id: string; building_id: string }[];
}) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id || "");

  const gebouw = buildings.find((b) => b.id === buildingId);
  const resCount = reservatiesVandaag.filter((r) => r.building_id === buildingId).length;
  const tellingCount = openTellingen.filter((t) => t.building_id === buildingId).length;
  const recent = useMemo(() => logboekRegels.filter((r) => r.building_id === buildingId).slice(0, 6), [logboekRegels, buildingId]);

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-[#EEEDFE] text-[#3C3489] flex items-center justify-center shrink-0">
          <Building2 size={14} />
        </div>
        <span className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Actief gebouw</span>
        <select
          value={buildingId}
          onChange={(e) => setBuildingId(e.target.value)}
          className="rounded-lg border border-[#ECECF3] px-3 py-1.5 text-sm font-semibold text-[#171A2B] bg-white"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {tellingCount > 0 ? (
        <div className="bg-[#FDF1DE] border border-[#F2DBAE] rounded-2xl px-5 py-3 mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A6A2C]">Actie vereist</div>
            <div className="text-sm font-semibold text-[#171A2B]">
              {tellingCount} telling(en) ter controle voor {gebouw?.name}
            </div>
          </div>
          <Link href="/controle" className="text-xs font-semibold bg-[#B4790C] text-white rounded-lg px-3 py-2 shrink-0">
            Bekijken
          </Link>
        </div>
      ) : (
        <div className="bg-[#E4F6EE] border border-[#BFE9D5] rounded-2xl px-5 py-3 mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1B8E63]">In orde</div>
          <div className="text-sm font-semibold text-[#171A2B]">Geen tellingen ter controle voor {gebouw?.name}.</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-[#ECECF3] px-4 py-3">
          <div className="text-xl font-bold text-[#171A2B]">{resCount}</div>
          <div className="text-xs text-[#8A8FA8]">reservatie(s) vandaag</div>
        </div>
        <div className="bg-white rounded-xl border border-[#ECECF3] px-4 py-3">
          <div className="text-xl font-bold text-[#171A2B]">{tellingCount}</div>
          <div className="text-xs text-[#8A8FA8]">te controleren</div>
        </div>
      </div>

      <div className="text-sm font-semibold text-[#8A8FA8] mb-2">Recente registraties voor {gebouw?.name}</div>
      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
        {recent.length === 0 && <div className="px-5 py-4 text-sm text-[#B0B4CC]">Nog geen recente activiteit voor dit gebouw.</div>}
        {recent.map((r, i) => (
          <div key={r.id} className={`flex items-center justify-between px-5 py-2.5 ${i > 0 ? "border-t border-[#ECECF3]" : ""}`}>
            <div className="min-w-0">
              <div className="text-sm text-[#171A2B] truncate">
                {ACTIE_LABELS[r.actie] || r.actie} &mdash; {r.omschrijving}
              </div>
              <div className="text-xs text-[#8A8FA8]">{r.gebruiker_naam || "Onbekend"}</div>
            </div>
            <div className="text-xs text-[#B0B4CC] whitespace-nowrap shrink-0 ml-2">{formatDateTime(r.created_at)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
