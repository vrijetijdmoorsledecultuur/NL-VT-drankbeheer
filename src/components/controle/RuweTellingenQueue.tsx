"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, X, AlertTriangle, Download, ChevronDown, ChevronUp } from "lucide-react";
import type { Building, Product, Reservation, RuweTelling, RuweTellingRegel, Telling, Telplek } from "@/lib/types";
import { approveRuweTelling, approveControletelling, dismissRuweTelling } from "@/app/(app)/controle/actions";
import { formatDate, formatDateTime } from "@/lib/format";
import PincodeConfirmModal from "@/components/PincodeConfirmModal";
import { genereerTellingPdf } from "@/lib/genereerTellingPdf";

function typeLabel(type: RuweTelling["type"]) {
  return type === "vooraf" ? "Vooraf" : type === "nadien" ? "Nadien" : "Controletelling";
}

export default function RuweTellingenQueue({
  ruweTellingen,
  verwerkteTellingen,
  ruweTellingRegels,
  reservations,
  buildings,
  products,
  tellingen,
  telplekken,
  heeftPincode = false,
}: {
  ruweTellingen: RuweTelling[];
  verwerkteTellingen: RuweTelling[];
  ruweTellingRegels: RuweTellingRegel[];
  reservations: Reservation[];
  buildings: Building[];
  products: Product[];
  tellingen: Telling[];
  telplekken: Telplek[];
  heeftPincode?: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();
  const [pincodeModalOpen, setPincodeModalOpen] = useState(false);
  const [toonVerwerkt, setToonVerwerkt] = useState(false);

  // Bewust geen early-return bij een lege lijst: dit vast onderdeel van het
  // scherm laten verdwijnen zorgt ervoor dat medewerkers niet meer weten dat
  // deze functie bestaat. Toon in plaats daarvan een lege-staat hieronder.

  function voorafFor(reservationId: string | null, productId: string) {
    if (!reservationId) return null;
    return tellingen.find((t) => t.reservation_id === reservationId && t.product_id === productId)?.vooraf ?? null;
  }

  function telplekNaam(telplekId: string | null): string | null {
    return telplekId ? telplekken.find((t) => t.id === telplekId)?.naam ?? null : null;
  }

  function hasConflict(t: RuweTelling) {
    if (t.type !== "nadien") return false;
    return ruweTellingRegels
      .filter((r) => r.ruwe_telling_id === t.id)
      .some((r) => {
        const vooraf = voorafFor(t.reservation_id, r.product_id);
        return vooraf !== null && r.aantal > vooraf;
      });
  }

  function openTelling(t: RuweTelling) {
    const regels = ruweTellingRegels.filter((r) => r.ruwe_telling_id === t.id);
    const map: Record<string, number> = {};
    for (const r of regels) map[r.product_id] = r.aantal;
    setAmounts(map);
    setOpenId(t.id);
  }

  function downloadPdf(t: RuweTelling) {
    const regels = ruweTellingRegels.filter((r) => r.ruwe_telling_id === t.id);
    const reservation = reservations.find((r) => r.id === t.reservation_id) || null;
    const gebouwNaam = buildings.find((b) => b.id === t.building_id)?.name || "?";
    genereerTellingPdf(t, regels, products, gebouwNaam, reservation, telplekNaam(t.telplek_id));
  }

  const open = ruweTellingen.find((t) => t.id === openId);

  if (open) {
    const reservation = reservations.find((r) => r.id === open.reservation_id);
    const building = buildings.find((b) => b.id === open.building_id);
    const isControle = open.type === "controle";
    const regelProductIds = ruweTellingRegels
      .filter((r) => r.ruwe_telling_id === open.id)
      .map((r) => r.product_id);

    function goedkeuren() {
      startTransition(async () => {
        const regels = regelProductIds.map((productId) => {
          const bron = ruweTellingRegels.find(
            (regel) => regel.ruwe_telling_id === open!.id && regel.product_id === productId
          );
          return {
            productId,
            aantal: amounts[productId] ?? 0,
            frigo: bron?.frigo ?? null,
            bakken: bron?.bakken ?? null,
            los: bron?.los ?? null,
          };
        });
        if (isControle) {
          await approveControletelling(open!.id, open!.building_id, regels);
        } else if (reservation) {
          await approveRuweTelling(open!.id, reservation.id, open!.type as "vooraf" | "nadien", regels);
        }
        const gebouwNaam = buildings.find((b) => b.id === open!.building_id)?.name || "?";
        genereerTellingPdf(
          open!,
          regelProductIds.map((productId) => {
            const bron = ruweTellingRegels.find(
              (regel) => regel.ruwe_telling_id === open!.id && regel.product_id === productId
            );
            return {
              ruwe_telling_id: open!.id,
              product_id: productId,
              aantal: amounts[productId] ?? 0,
              frigo: bron?.frigo ?? null,
              bakken: bron?.bakken ?? null,
              los: bron?.los ?? null,
            };
          }),
          products,
          gebouwNaam,
          reservation || null,
          telplekNaam(open!.telplek_id)
        );
        setOpenId(null);
        router.refresh();
      });
    }

    return (
      <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="font-bold text-[#171A2B]">
              {building?.name} &middot; {typeLabel(open.type)}
              {telplekNaam(open.telplek_id) && <span className="text-[#8A8FA8] font-normal"> &middot; {telplekNaam(open.telplek_id)}</span>}
            </div>
            <div className="text-xs text-[#8A8FA8]">
              {isControle ? "Los van een reservatie" : `${reservation?.huurder || "?"} · ${formatDate(reservation?.begin_datum)}`}
              {open.ingevoerd_door ? ` \u00b7 ingevoerd door ${open.ingevoerd_door}` : ""}
            </div>
          </div>
          <button onClick={() => setOpenId(null)} className="text-[#8A8FA8] hover:text-[#171A2B]">
            <X size={18} />
          </button>
        </div>

        {open.afwijking_bevestigd && (
          <div className="mt-3 bg-[#FDF1DE] border border-[#F2DBAE] rounded-lg px-3 py-2 text-xs text-[#8A6A2C] flex items-center gap-2">
            <AlertTriangle size={13} />
            Het poetspersoneel zag zelf al een waarschuwing en bevestigde dat deze aantallen toch kloppen.
          </div>
        )}

        {open.vaste_voorraad_bevestigd && (
          <div className="mt-3 bg-[#E4F6EE] border border-[#BFE9D5] rounded-lg px-3 py-2 text-xs text-[#1B8E63]">
            Ingevuld op basis van de vaste voorraad, bevestigd door het poetspersoneel.
          </div>
        )}

        <div className="mt-4 divide-y divide-[#ECECF3]">
          {regelProductIds.map((pid) => {
            const product = products.find((p) => p.id === pid);
            if (!product) return null;
            const detail = ruweTellingRegels.find(
              (regel) => regel.ruwe_telling_id === open.id && regel.product_id === pid
            );
            const vooraf = open.type === "nadien" ? voorafFor(open.reservation_id, pid) : null;
            const conflict = vooraf !== null && (amounts[pid] ?? 0) > vooraf;
            return (
              <div key={pid} className={`py-2.5 ${conflict ? "bg-[#FDECEC] -mx-5 px-5" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#171A2B]">{product.name}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={amounts[pid] ?? 0}
                    onChange={(e) => setAmounts((a) => ({ ...a, [pid]: Number(e.target.value) || 0 }))}
                    className={`w-20 text-center text-sm font-semibold border rounded-lg py-1.5 ${
                      conflict ? "border-[#D6493C] text-[#D6493C]" : "border-[#ECECF3]"
                    }`}
                  />
                </div>
                {(detail?.frigo != null || detail?.bakken != null || detail?.los != null) && (
                  <div className="text-[11px] text-[#8A8FA8] mt-1">
                    Frigo: {detail?.frigo ?? 0} flesjes &middot; Berging: {detail?.bakken ?? 0} bakken + {detail?.los ?? 0} losse
                  </div>
                )}
                {conflict && (
                  <div className="text-xs text-[#D6493C] mt-1 flex items-center gap-1">
                    <AlertTriangle size={11} /> Vooraf geteld: {vooraf}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            disabled={pending || (!isControle && !reservation)}
            onClick={() => (heeftPincode ? setPincodeModalOpen(true) : goedkeuren())}
            className="flex-1 py-2.5 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
          >
            Goedkeuren &amp; verwerken
          </button>
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await dismissRuweTelling(open.id);
                setOpenId(null);
                router.refresh();
              })
            }
            className="px-4 py-2.5 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#8A8FA8]"
          >
            Negeren
          </button>
        </div>

        <PincodeConfirmModal
          open={pincodeModalOpen}
          title="Telling goedkeuren en verwerken?"
          description={isControle ? "Dit wordt het nieuwe ijkpunt voor de live voorraad." : "Dit telt vanaf nu mee in de voorraad en facturatie."}
          onCancel={() => setPincodeModalOpen(false)}
          onConfirmed={() => {
            setPincodeModalOpen(false);
            goedkeuren();
          }}
        />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-6">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#FDF1DE] text-[#B4790C] flex items-center justify-center shrink-0">
          <ClipboardCheck size={15} />
        </div>
        <div>
          <div className="font-bold text-[#171A2B]">Tellingen ter controle</div>
          <div className="text-xs text-[#8A8FA8]">
            Ingevoerd via de tellen-link, telt pas mee na jouw goedkeuring. Bij goedkeuren wordt automatisch een PDF gedownload.
          </div>
        </div>
      </div>
      <div className="divide-y divide-[#ECECF3]">
        {ruweTellingen.length === 0 && (
          <div className="px-5 py-6 text-sm text-[#B0B4CC]">Niets op dit moment — nieuwe tellingen verschijnen hier automatisch.</div>
        )}
        {ruweTellingen.map((t) => {
          const reservation = reservations.find((r) => r.id === t.reservation_id);
          const building = buildings.find((b) => b.id === t.building_id);
          const conflict = hasConflict(t);
          return (
            <button
              key={t.id}
              onClick={() => openTelling(t)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[#F7F7FB]"
            >
              <div>
                <div className="text-sm font-semibold text-[#171A2B]">
                  {building?.name} &middot; {typeLabel(t.type)}
                  {telplekNaam(t.telplek_id) && <span className="text-[#8A8FA8] font-normal"> &middot; {telplekNaam(t.telplek_id)}</span>}
                  {!t.telplek_id && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#E7F0FD] text-[#2F6FCB] rounded-full px-2 py-0.5 ml-2">
                      via gastcode
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#8A8FA8]">
                  {t.type === "controle" ? "Los van een reservatie" : reservation?.huurder || "Onbekende reservatie"}
                  {t.ingevoerd_door ? ` \u00b7 ${t.ingevoerd_door}` : ""}
                </div>
              </div>
              {conflict ? (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#FDECEC] text-[#D6493C] rounded-full px-2 py-0.5 flex items-center gap-1">
                  <AlertTriangle size={10} /> klopt niet
                </span>
              ) : (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-[#FDF1DE] text-[#B4790C] rounded-full px-2 py-0.5">
                  nieuw
                </span>
              )}
            </button>
          );
        })}
      </div>

      {verwerkteTellingen.length > 0 && (
        <div className="border-t border-[#ECECF3]">
          <button
            onClick={() => setToonVerwerkt((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-[#6D5AE6]"
          >
            Recent goedgekeurd ({verwerkteTellingen.length})
            {toonVerwerkt ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {toonVerwerkt && (
            <div className="divide-y divide-[#ECECF3]">
              {verwerkteTellingen.map((t) => {
                const reservation = reservations.find((r) => r.id === t.reservation_id);
                const building = buildings.find((b) => b.id === t.building_id);
                return (
                  <div key={t.id} className="flex items-center justify-between px-5 py-2.5">
                    <div>
                      <div className="text-sm text-[#171A2B]">
                        {building?.name} &middot; {typeLabel(t.type)}
                        {telplekNaam(t.telplek_id) && <span className="text-[#8A8FA8]"> &middot; {telplekNaam(t.telplek_id)}</span>}
                      </div>
                      <div className="text-xs text-[#8A8FA8]">
                        {t.type === "controle" ? "Los van een reservatie" : reservation?.huurder || "?"} &middot; {formatDateTime(t.created_at)}
                      </div>
                    </div>
                    <button
                      onClick={() => downloadPdf(t)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ECECF3] text-xs font-semibold text-[#171A2B] hover:bg-[#F7F7FB]"
                    >
                      <Download size={12} /> PDF
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
