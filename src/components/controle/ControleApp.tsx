"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, AlertTriangle } from "lucide-react";
import type { Building, Reservation, Product, Telling, VerbruikRegel, Contact, RuweTelling, RuweTellingRegel, Telplek, ReservationToegangscode, ProductPrijs, ReservationBoete, Factuur, FactuurRegel } from "@/lib/types";
import ReservatieDetail from "./ReservatieDetail";
import RuweTellingenQueue from "./RuweTellingenQueue";
import FacturenGoedkeuring from "./FacturenGoedkeuring";
import { formatDate } from "@/lib/format";

function Pill({ tone, children }: { tone: "amber" | "green" | "blue"; children: React.ReactNode }) {
  const tones = { amber: "bg-[#FDF0DA] text-[#B4741A]", green: "bg-[#E4F6EE] text-[#1B8E63]", blue: "bg-[#E7F0FD] text-[#2F6FCB]" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${tones[tone]}`}>{children}</span>;
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
  prijzen,
  facturen,
  factuurRegels,
  extraProducten,
  contacts,
  ruweTellingen,
  verwerkteTellingen,
  ruweTellingRegels,
  telplekken,
  toegangscodes,
  canEdit,
  initialReservationId,
  heeftPincode,
}: {
  buildings: Building[];
  reservations: Reservation[];
  products: Product[];
  productBuildings: { product_id: string; building_id: string }[];
  tellingen: Telling[];
  leveringen: VerbruikRegel[];
  eigenVerbruik: VerbruikRegel[];
  boetes: ReservationBoete[];
  prijzen: ProductPrijs[];
  facturen: Factuur[];
  factuurRegels: FactuurRegel[];
  extraProducten: { reservation_id: string; product_id: string }[];
  contacts: Contact[];
  ruweTellingen: RuweTelling[];
  verwerkteTellingen: RuweTelling[];
  ruweTellingRegels: RuweTellingRegel[];
  telplekken: Telplek[];
  toegangscodes: ReservationToegangscode[];
  canEdit: boolean;
  initialReservationId?: string;
  heeftPincode: boolean;
}) {
  const router = useRouter();
  const [openBuildingId, setOpenBuildingId] = useState<string | null>(null);
  const [openReservationId, setOpenReservationId] = useState<string | null>(
    initialReservationId ? reservations.find((r) => r.id === initialReservationId)?.id || null : null
  );

  const perBuilding = useMemo(
    () =>
      buildings.map((b) => {
        const list = reservations.filter((r) => r.building_id === b.id);
        const openReservaties = list.filter((r) => r.status === "wacht");
        // Enkel reservaties die ook effectief drankgegevens hebben (telling,
        // levering of eigen verbruik) vragen om een dranktelling te
        // controleren — een reservatie zonder verbruik (bv. een vereniging
        // die nooit drinkt) hoeft daar niet in mee te tellen.
        const metVerbruik = openReservaties.filter(
          (r) =>
            tellingen.some((t) => t.reservation_id === r.id && (t.vooraf != null || t.nadien != null)) ||
            leveringen.some((l) => l.reservation_id === r.id) ||
            eigenVerbruik.some((e) => e.reservation_id === r.id)
        );
        return { building: b, openReservaties: openReservaties.length, metVerbruik: metVerbruik.length, total: list.length };
      }),
    [buildings, reservations, tellingen, leveringen, eigenVerbruik]
  );
  const totaalTeControleren = perBuilding.reduce((s, b) => s + b.metVerbruik, 0);

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
        boetes={boetes.filter((b) => b.reservation_id === res.id)}
        prijzen={prijzen}
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
              {r.status === "wacht" ? (
                <Pill tone="amber">Actie nodig</Pill>
              ) : r.recreatex_verwerkt ? (
                <Pill tone="green">Verwerkt in Recreatex</Pill>
              ) : (
                <Pill tone="blue">Klaar voor Recreatex</Pill>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-bold text-[#171A2B]">Inkomende tellingen</h1>
        <div className="text-right">
          <div className="text-3xl font-bold text-[#171A2B]">{totaalTeControleren}</div>
          <div className="text-xs text-[#8A8FA8]">dranktellingen te controleren</div>
        </div>
      </div>
      <p className="text-[#8A8FA8] text-sm mb-6">Kies een gebouw om de tellingen na te kijken.</p>

      <FacturenGoedkeuring facturen={facturen} factuurRegels={factuurRegels} buildings={buildings} products={products} />

      <RuweTellingenQueue
        ruweTellingen={ruweTellingen}
        verwerkteTellingen={verwerkteTellingen}
        ruweTellingRegels={ruweTellingRegels}
        reservations={reservations}
        buildings={buildings}
        products={products}
        tellingen={tellingen}
        telplekken={telplekken}
        heeftPincode={heeftPincode}
      />

      <div className="grid md:grid-cols-3 gap-4">
        {perBuilding.map(({ building, openReservaties, metVerbruik }) => (
          <button
            key={building.id}
            onClick={() => setOpenBuildingId(building.id)}
            className={`text-left rounded-2xl border-t-4 bg-white p-5 hover:shadow-md transition-shadow border border-[#ECECF3] ${
              metVerbruik > 0 ? "border-t-[#E2A93A]" : "border-t-[#1FAE7A]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-[#171A2B]">{building.name}</span>
              {metVerbruik > 0 ? (
                <Pill tone="amber">Actie nodig</Pill>
              ) : (
                <Pill tone="green">In orde</Pill>
              )}
            </div>
            <div className="text-3xl font-bold text-[#171A2B] mb-1">{metVerbruik}</div>
            <div className="text-sm text-[#8A8FA8] flex items-center gap-1 mb-2">
              {metVerbruik > 0 && <AlertTriangle size={13} className="text-[#E2A93A]" />}
              dranktelling(en) te controleren
            </div>
            <div className="text-xs text-[#B0B4CC]">{openReservaties} zaalreservatie(s) nog niet afgerond</div>
          </button>
        ))}
      </div>
    </div>
  );
}
