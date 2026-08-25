"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import type { Reservation, Building, Contact } from "@/lib/types";
import { deleteReservation } from "@/app/(app)/reservaties/actions";
import { formatDate } from "@/lib/format";
import PincodeConfirmModal from "@/components/PincodeConfirmModal";

function Pill({ tone, children }: { tone: "amber" | "green"; children: React.ReactNode }) {
  const tones = {
    amber: "bg-[#FDF0DA] text-[#B4741A]",
    green: "bg-[#E4F6EE] text-[#1B8E63]",
  };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tones[tone]}`}>{children}</span>;
}

// Toont de actuele verenigingsnaam als het contact al opgesplitst werd in
// Contactenbeheer, anders de oorspronkelijke, ruwe naam uit de PDF-import.
function displayHuurder(r: Reservation, contacts: Contact[]) {
  const c = r.contact_id ? contacts.find((x) => x.id === r.contact_id) : null;
  return c?.vereniging || r.huurder;
}

export default function ReservationsList({
  reservations,
  buildings,
  contacts,
  canEdit,
  heeftPincode = false,
}: {
  reservations: Reservation[];
  buildings: Building[];
  contacts: Contact[];
  canEdit: boolean;
  heeftPincode?: boolean;
}) {
  const [, startTransition] = useTransition();
  const [teVerwijderen, setTeVerwijderen] = useState<Reservation | null>(null);
  const buildingName = (id: string) => buildings.find((b) => b.id === id)?.name || "—";

  function vraagVerwijderBevestiging(r: Reservation) {
    if (heeftPincode) {
      setTeVerwijderen(r);
    } else if (confirm(`Reservatie van "${displayHuurder(r, contacts)}" verwijderen?`)) {
      startTransition(() => deleteReservation(r.id));
    }
  }

  if (reservations.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-6 text-sm text-[#B0B4CC]">
        Nog geen reservaties. Upload hierboven een PDF om te starten.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-x-auto">
      <table className="w-full text-sm table-fixed">
        <colgroup>
          <col className="w-[26%]" />
          <col className="w-[24%]" />
          <col className="w-[13%]" />
          <col className="w-[20%]" />
          <col className="w-[12%]" />
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
          {reservations.map((r) => {
            const huurderNaam = displayHuurder(r, contacts);
            return (
              <tr key={r.id} className="border-t border-[#ECECF3]">
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
                  {r.status === "wacht" ? <Pill tone="amber">Actie nodig</Pill> : <Pill tone="green">In orde</Pill>}
                </td>
                {canEdit && (
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => vraagVerwijderBevestiging(r)} className="text-[#B0B4CC] hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

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
