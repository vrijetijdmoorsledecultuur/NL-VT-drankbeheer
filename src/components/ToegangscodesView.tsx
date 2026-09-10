"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Building, Reservation, ReservationToegangscode } from "@/lib/types";
import { formatDate } from "@/lib/format";
import ToegangscodePaneel from "@/components/ToegangscodePaneel";

export default function ToegangscodesView({
  buildings,
  reservations,
  toegangscodes,
}: {
  buildings: Building[];
  reservations: Reservation[];
  toegangscodes: ReservationToegangscode[];
}) {
  const router = useRouter();
  const [reservationId, setReservationId] = useState("");

  const codesVoorReservatie = useMemo(
    () => toegangscodes.filter((t) => t.reservation_id === reservationId),
    [toegangscodes, reservationId]
  );

  const reservatiesMetCode = useMemo(() => {
    const ids = new Set(toegangscodes.map((t) => t.reservation_id));
    return reservations.filter((r) => ids.has(r.id));
  }, [reservations, toegangscodes]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">Externe toegangscode</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">
        Voor kleinere activiteiten met &eacute;&eacute;n verantwoordelijke: verstuur automatisch een code waarmee
        die persoon zelf, zonder account, het verbruik registreert.
      </p>

      <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Reservatie</label>
        <select
          value={reservationId}
          onChange={(e) => setReservationId(e.target.value)}
          className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
        >
          <option value="">Kies een reservatie&hellip;</option>
          {reservations.map((r) => (
            <option key={r.id} value={r.id}>
              {formatDate(r.begin_datum)} &middot; {buildings.find((b) => b.id === r.building_id)?.name || "?"}
              {r.ruimte ? ` (${r.ruimte})` : ""} &middot; {r.huurder}
            </option>
          ))}
        </select>
      </div>

      {reservationId && (
        <div className="mb-8">
          <ToegangscodePaneel reservationId={reservationId} toegangscodes={codesVoorReservatie} onChanged={() => router.refresh()} />
        </div>
      )}

      {reservatiesMetCode.length > 0 && (
        <div>
          <div className="text-sm font-semibold text-[#171A2B] mb-2">Reservaties met een toegangscode</div>
          <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
            {reservatiesMetCode.map((r, i) => {
              const codes = toegangscodes.filter((t) => t.reservation_id === r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => setReservationId(r.id)}
                  className={`w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#F7F7FB] ${i > 0 ? "border-t border-[#ECECF3]" : ""}`}
                >
                  <div>
                    <div className="text-sm font-semibold text-[#171A2B]">{r.huurder}</div>
                    <div className="text-xs text-[#8A8FA8]">
                      {buildings.find((b) => b.id === r.building_id)?.name} &middot; {formatDate(r.begin_datum)}
                    </div>
                  </div>
                  <div className="text-xs text-[#8A8FA8]">
                    {codes.filter((c) => c.verstuurd).length}/{codes.length} verstuurd
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
