"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Trash2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Reservation, Building, Contact } from "@/lib/types";
import { deleteReservation } from "@/app/(app)/reservaties/actions";
import { formatDate } from "@/lib/format";
import PincodeConfirmModal from "@/components/PincodeConfirmModal";

const GEBOUW_KLEUREN = [
  { bg: "bg-[#E7F0FD]", border: "border-l-[#2F6FCB]", text: "text-[#2F6FCB]" },
  { bg: "bg-[#FCEDEC]", border: "border-l-[#D6493C]", text: "text-[#D6493C]" },
  { bg: "bg-[#E4F6EE]", border: "border-l-[#1B8E63]", text: "text-[#1B8E63]" },
  { bg: "bg-[#FDF0DA]", border: "border-l-[#B4741A]", text: "text-[#B4741A]" },
  { bg: "bg-[#EEEDFE]", border: "border-l-[#6D5AE6]", text: "text-[#6D5AE6]" },
  { bg: "bg-[#FCE9EE]", border: "border-l-[#C9497B]", text: "text-[#C9497B]" },
];

function Pill({ tone, children }: { tone: "amber" | "green" | "blue"; children: React.ReactNode }) {
  const tones = {
    amber: "bg-[#FDF0DA] text-[#B4741A]",
    green: "bg-[#E4F6EE] text-[#1B8E63]",
    blue: "bg-[#E7F0FD] text-[#2F6FCB]",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

// Toont de actuele verenigingsnaam als het contact al opgesplitst werd in
// Contactenbeheer, anders de oorspronkelijke, ruwe naam uit de PDF-import.
function displayHuurder(r: Reservation, contacts: Contact[]) {
  const c = r.contact_id ? contacts.find((x) => x.id === r.contact_id) : null;
  return c?.vereniging || r.huurder;
}

function lokaleDatumStr(d: Date) {
  const jaar = d.getFullYear();
  const maand = String(d.getMonth() + 1).padStart(2, "0");
  const dag = String(d.getDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}

function vandaag() {
  return lokaleDatumStr(new Date());
}

function maandagVanWeek(datum: Date) {
  const d = new Date(datum);
  const dag = d.getDay();
  const verschil = dag === 0 ? -6 : 1 - dag;
  d.setDate(d.getDate() + verschil);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAGNAMEN = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];

export default function ReservationsList({
  reservations,
  buildings,
  contacts,
  canEdit,
  heeftPincode = false,
  initialTab = "komende",
}: {
  reservations: Reservation[];
  buildings: Building[];
  contacts: Contact[];
  canEdit: boolean;
  heeftPincode?: boolean;
  initialTab?: "komende" | "afgelopen" | "kalender";
}) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [teVerwijderen, setTeVerwijderen] = useState<Reservation | null>(null);
  const [tab, setTab] = useState<"komende" | "afgelopen" | "kalender">(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [weekStart, setWeekStart] = useState(() => maandagVanWeek(new Date()));
  const buildingName = (id: string) => buildings.find((b) => b.id === id)?.name || "—";
  const buildingKleur = (id: string) => {
    const i = buildings.findIndex((b) => b.id === id);
    return GEBOUW_KLEUREN[(i >= 0 ? i : 0) % GEBOUW_KLEUREN.length];
  };

  const vandaagStr = vandaag();
  const komende = useMemo(
    () => reservations.filter((r) => r.eind_datum >= vandaagStr).sort((a, b) => a.begin_datum.localeCompare(b.begin_datum)),
    [reservations, vandaagStr]
  );
  const afgelopen = useMemo(
    () => reservations.filter((r) => r.eind_datum < vandaagStr).sort((a, b) => b.begin_datum.localeCompare(a.begin_datum)),
    [reservations, vandaagStr]
  );

  function vraagVerwijderBevestiging(r: Reservation) {
    if (heeftPincode) {
      setTeVerwijderen(r);
    } else if (confirm(`Reservatie van "${displayHuurder(r, contacts)}" verwijderen?`)) {
      startTransition(() => deleteReservation(r.id));
    }
  }

  const tonen = tab === "komende" ? komende : afgelopen;

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        {(["komende", "afgelopen", "kalender"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
              tab === t ? "bg-[#6D5AE6] text-white" : "text-[#5B5F82] hover:bg-[#F7F7FB]"
            }`}
          >
            {t === "komende" ? `Komende (${komende.length})` : t === "afgelopen" ? `Afgelopen (${afgelopen.length})` : "Kalender"}
          </button>
        ))}
      </div>

      {tab === "kalender" ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7))}
              className="p-2 rounded-lg border border-[#ECECF3] text-[#5B5F82] hover:bg-[#F7F7FB]"
            >
              <ChevronLeft size={15} />
            </button>
            <button onClick={() => setWeekStart(maandagVanWeek(new Date()))} className="text-xs font-semibold text-[#6D5AE6]">
              Deze week
            </button>
            <button
              onClick={() => setWeekStart((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7))}
              className="p-2 rounded-lg border border-[#ECECF3] text-[#5B5F82] hover:bg-[#F7F7FB]"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => {
              const dag = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i);
              const dagStr = lokaleDatumStr(dag);
              const dagReservaties = reservations
                .filter((r) => r.begin_datum <= dagStr && r.eind_datum >= dagStr)
                .sort((a, b) => (a.toegang_start || "").localeCompare(b.toegang_start || ""));
              const isVandaag = dagStr === vandaagStr;
              return (
                <div key={dagStr} className="min-w-0">
                  <div className={`flex items-center gap-1.5 mb-2 ${isVandaag ? "text-[#6D5AE6]" : "text-[#171A2B]"}`}>
                    <span className="text-sm font-bold">{DAGNAMEN[dag.getDay()]}</span>
                  </div>
                  <div className="text-[11px] text-[#8A8FA8] mb-2">{formatDate(dagStr)}</div>
                  <div className="space-y-2">
                    {dagReservaties.length === 0 && <div className="text-xs text-[#D8DAE8]">—</div>}
                    {dagReservaties.map((r) => {
                      const kleur = buildingKleur(r.building_id);
                      return (
                        <button
                          key={r.id}
                          onClick={() => router.push(`/controle?reservationId=${r.id}`)}
                          className={`w-full text-left rounded-lg border-l-4 ${kleur.border} ${kleur.bg} px-2.5 py-2`}
                        >
                          <div className={`text-[10px] font-semibold ${kleur.text} truncate`}>
                            {buildingName(r.building_id)}
                            {r.ruimte ? ` · ${r.ruimte}` : ""}
                          </div>
                          <div className="text-xs font-semibold text-[#171A2B] truncate mt-0.5">{displayHuurder(r, contacts)}</div>
                          {r.activiteit && <div className="text-[11px] text-[#5B5F82] truncate">{r.activiteit}</div>}
                          {(r.toegang_start || r.toegang_eind) && (
                            <div className="text-[10px] text-[#8A8FA8] flex items-center gap-1 mt-1">
                              <Clock size={9} />
                              {r.toegang_start ?? "?"}&ndash;{r.toegang_eind ?? "?"}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : tonen.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-6 text-sm text-[#B0B4CC]">
          {reservations.length === 0 ? "Nog geen reservaties. Upload hierboven een PDF om te starten." : `Geen ${tab} reservaties.`}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[22%]" />
              <col className="w-[13%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              {canEdit && <col className="w-[5%]" />}
            </colgroup>
            <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold rounded-tl-2xl">Huurder</th>
                <th className="text-left px-3 py-2.5 font-semibold">Gebouw</th>
                <th className="text-left px-3 py-2.5 font-semibold">Datum</th>
                <th className="text-left px-3 py-2.5 font-semibold">Activiteit</th>
                <th className={`text-left px-3 py-2.5 font-semibold ${!canEdit ? "rounded-tr-2xl" : ""}`}>Status</th>
                {canEdit && <th className="px-3 py-2.5 rounded-tr-2xl"></th>}
              </tr>
            </thead>
            <tbody>
              {tonen.map((r) => {
                const huurderNaam = displayHuurder(r, contacts);
                return (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/controle?reservationId=${r.id}`)}
                    className="border-t border-[#ECECF3] cursor-pointer hover:bg-[#F7F7FB]"
                  >
                    <td className="px-3 py-2 font-medium text-[#171A2B] truncate" title={huurderNaam}>
                      {huurderNaam}
                    </td>
                    <td className="px-3 py-2 text-[#5B5F82] truncate" title={`${buildingName(r.building_id)}${r.ruimte ? " · " + r.ruimte : ""}`}>
                      {buildingName(r.building_id)}
                      {r.ruimte && <span className="text-[#B0B4CC]"> · {r.ruimte}</span>}
                    </td>
                    <td className="px-3 py-2 text-[#5B5F82] whitespace-nowrap">
                      {formatDate(r.begin_datum)}
                      {r.eind_datum !== r.begin_datum && <> &rarr; {formatDate(r.eind_datum)}</>}
                    </td>
                    <td className="px-3 py-2 text-[#5B5F82] truncate" title={r.activiteit || ""}>
                      {r.activiteit || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {r.status === "wacht" ? (
                        <Pill tone="amber">Actie nodig</Pill>
                      ) : r.recreatex_verwerkt ? (
                        <Pill tone="green">Verwerkt in Recreatex</Pill>
                      ) : (
                        <Pill tone="blue">Klaar voor Recreatex</Pill>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            vraagVerwijderBevestiging(r);
                          }}
                          className="text-[#B0B4CC] hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <PincodeConfirmModal
        open={!!teVerwijderen}
        title={`Reservatie van "${teVerwijderen ? displayHuurder(teVerwijderen, contacts) : ""}" verwijderen?`}
        description="Dit kan niet ongedaan gemaakt worden."
        onCancel={() => setTeVerwijderen(null)}
        onConfirmed={() => {
          if (teVerwijderen) startTransition(() => deleteReservation(teVerwijderen.id));
          setTeVerwijderen(null);
        }}
      />
    </div>
  );
}
