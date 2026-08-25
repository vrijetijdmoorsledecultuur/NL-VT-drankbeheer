"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, AlertTriangle } from "lucide-react";
import type { Building, Reservation, Product, Telling, VerbruikRegel, Contact, RuweTelling, RuweTellingRegel, Telplek, ReservationToegangscode } from "@/lib/types";
import ReservatieDetail from "./ReservatieDetail";
import RuweTellingenQueue from "./RuweTellingenQueue";
import { formatDate } from "@/lib/format";

function Pill({ tone, children }: { tone: "amber" | "green"; children: React.ReactNode }) {
  const tones = { amber: "bg-[#FDF0DA] text-[#B4741A]", green: "bg-[#E4F6EE] text-[#1B8E63]" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tones[tone]}`}>{children}</span>;
}

function displayHuurder(res: Reservation, contacts: Contact[]) {
  const c = res.contact_id ? contacts.find((x) => x.id === res.contact_id) : null;
  return c?.vereniging || res.huurder;
}

export default function ControleApp({
  buildings,
  reservations,
  products,
  productBuildings,
  tellingen,
  leveringen,
  eigenVerbruik,
  boetes,
  extraProducten,
  contacts,
  ruweTellingen,
  ruweTellingRegels,
  telplekken,
  toegangscodes,
  canEdit,
  heeftPincode,
}: {
  buildings: Building[];
  reservations: Reservation[];
  products: Product[];
  productBuildings: { product_id: string; building_id: string }[];
  tellingen: Telling[];
  leveringen: VerbruikRegel[];
  eigenVerbruik: VerbruikRegel[];
  boetes: { reservation_id: string; product_id: string }[];
  extraProducten: { reservation_id: string; product_id: string }[];
  contacts: Contact[];
  ruweTellingen: RuweTelling[];
  ruweTellingRegels: RuweTellingRegel[];
  telplekken: Telplek[];
  toegangscodes: ReservationToegangscode[];
  canEdit: boolean;
  heeftPincode: boolean;
}) {
  const router = useRouter();
  const [openBuildingId, setOpenBuildingId] = useState<string | null>(null);
  const [openReservationId, setOpenReservationId] = useState<string | null>(null);

  const perBuilding = useMemo(
    () =>
      buildings.map((b) => {
        const list = reservations.filter((r) => r.building_id === b.id);
        return { building: b, pending: list.filter((r) => r.status === "wacht").length, total: list.length };
      }),
    [buildings, reservations]
  );
  const totaalTeControleren = perBuilding.reduce((s, b) => s + b.pending, 0);

  function refresh() {
    router.refresh();
  }

  if (openReservationId) {
    const res = reservations.find((r) => r.id === openReservationId);
    if (!res) {
      setOpenReservationId(null);
      return null;
    }
    return (
      <ReservatieDetail
        reservation={res}
        allReservations={reservations}
        products={products}
        productBuildings={productBuildings}
        tellingen={tellingen}
        leveringen={leveringen}
        eigenVerbruik={eigenVerbruik}
        boeteProductIds={boetes.filter((b) => b.reservation_id === res.id).map((b) => b.product_id)}
        extraProductIds={extraProducten.filter((e) => e.reservation_id === res.id).map((e) => e.product_id)}
        toegangscodes={toegangscodes.filter((t) => t.reservation_id === res.id)}
        huurderNaam={displayHuurder(res, contacts)}
        gebouwNaam={buildings.find((b) => b.id === res.building_id)?.name || ""}
        canEdit={canEdit}
        onBack={() => setOpenReservationId(null)}
        onChanged={refresh}
      />
    );
  }

  if (openBuildingId) {
    const building = buildings.find((b) => b.id === openBuildingId);
    const list = reservations.filter((r) => r.building_id === openBuildingId);
    return (
      <div>
        <button onClick={() => setOpenBuildingId(null)} className="text-sm text-[#6D5AE6] font-medium mb-4 flex items-center gap-1">
          <ChevronRight size={14} className="rotate-180" /> Alle gebouwen
        </button>
        <h1 className="text-2xl font-bold text-[#171A2B] mb-6">{building?.name}</h1>
        <div className="bg-white rounded-2xl border border-[#ECECF3] divide-y divide-[#ECECF3]">
          {list.length === 0 && <div className="px-5 py-6 text-sm text-[#B0B4CC]">Geen reservaties.</div>}
          {list.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpenReservationId(r.id)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F7F7FB]"
            >
              <div>
                <div className="font-medium text-[#171A2B]">{displayHuurder(r, contacts)}</div>
                <div className="text-xs text-[#8A8FA8]">{formatDate(r.begin_datum)} · {r.activiteit || "—"}</div>
              </div>
              {r.status === "wacht" ? <Pill tone="amber">Actie nodig</Pill> : <Pill tone="green">In orde</Pill>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-[#171A2B]">Waar is controle nodig?</h1>
        <div className="text-right">
          <div className="text-3xl font-bold text-[#171A2B]">{totaalTeControleren}</div>
          <div className="text-xs text-[#8A8FA8]">totaal te controleren</div>
        </div>
      </div>
      <p className="text-[#8A8FA8] text-sm mb-6">Kies een gebouw om de tellingen na te kijken.</p>

      <RuweTellingenQueue
        ruweTellingen={ruweTellingen}
        ruweTellingRegels={ruweTellingRegels}
        reservations={reservations}
        buildings={buildings}
        products={products}
        tellingen={tellingen}
        telplekken={telplekken}
        heeftPincode={heeftPincode}
      />

      <div className="grid md:grid-cols-3 gap-4">
        {perBuilding.map(({ building, pending }) => (
          <button
            key={building.id}
            onClick={() => setOpenBuildingId(building.id)}
            className={`text-left rounded-2xl border-t-4 bg-white p-5 hover:shadow-md transition-shadow border border-[#ECECF3] ${
              pending > 0 ? "border-t-[#E2A93A]" : "border-t-[#1FAE7A]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-[#171A2B]">{building.name}</span>
              {pending > 0 ? (
                <Pill tone="amber">Actie nodig</Pill>
              ) : (
                <Pill tone="green">In orde</Pill>
              )}
            </div>
            <div className="text-3xl font-bold text-[#171A2B] mb-1">{pending}</div>
            <div className="text-sm text-[#8A8FA8] flex items-center gap-1">
              {pending > 0 && <AlertTriangle size={13} className="text-[#E2A93A]" />}
              reservatie(s) te controleren
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
