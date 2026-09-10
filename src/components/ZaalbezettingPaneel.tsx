"use client";

import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import type { Building, Reservation, Contact } from "@/lib/types";
import { formatDate } from "@/lib/format";

export default function ZaalbezettingPaneel({
  selectedDate,
  buildings,
  reservations,
  contacts,
}: {
  selectedDate: string;
  buildings: Building[];
  reservations: Reservation[];
  contacts: Contact[];
}) {
  const router = useRouter();
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const buildingsWithData = buildings.filter((b) => reservations.some((r) => r.building_id === b.id));

  function huurderNaam(r: Reservation) {
    const contact = r.contact_id ? contactById.get(r.contact_id) : null;
    return contact?.vereniging || r.huurder;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-[#8A8FA8]">Zaalbezetting</div>
        <input
          type="date"
          defaultValue={selectedDate}
          onChange={(e) => router.push(`/dashboard?zaaldatum=${e.target.value}`)}
          className="rounded-lg border border-[#ECECF3] px-3 py-1.5 text-sm bg-white"
        />
      </div>

      {buildingsWithData.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-4 text-sm text-[#B0B4CC]">
          Geen zaalreservaties op {formatDate(selectedDate)}.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
          <div className="divide-y divide-[#ECECF3]">
            {buildingsWithData.map((b) => {
              const items = reservations.filter((r) => r.building_id === b.id);
              return (
                <div key={b.id} className="px-5 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MapPin size={13} className="text-[#8A8FA8]" />
                    <span className="text-sm font-semibold text-[#171A2B]">{b.name}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-3 pl-5">
                        <div className="min-w-0">
                          <span className="text-sm text-[#171A2B] font-medium">{huurderNaam(r)}</span>
                          {r.activiteit && <span className="text-sm text-[#8A8FA8]"> &middot; {r.activiteit}</span>}
                        </div>
                        <div className="text-xs text-[#8A8FA8] whitespace-nowrap shrink-0">
                          {r.ruimte && <span className="font-medium text-[#5B5F82]">{r.ruimte}</span>}
                          {(r.activiteit_start || r.activiteit_eind) && (
                            <span>
                              {" "}
                              &middot; {r.activiteit_start ?? "?"}&ndash;{r.activiteit_eind ?? "?"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
