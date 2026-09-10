"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Plus, Trash2, CheckCircle2, Download } from "lucide-react";
import type { Reservation, Product, Telling, VerbruikRegel, ReservationToegangscode, ProductPrijs, ReservationBoete } from "@/lib/types";
import { computeVerbruik, computeTotaal, prijsOpDatum } from "@/lib/verbruik";
import { formatDate, formatDateTime } from "@/lib/format";
import { uploadBoeteBewijs } from "@/lib/uploadBoeteBewijs";
import { updateContact } from "@/app/(app)/contacten/actions";
import { genereerReservatiePdf } from "@/lib/genereerReservatiePdf";
import ToegangscodePaneel from "@/components/ToegangscodePaneel";
import {
  setTelling,
  setTellingDetail,
  addVerbruikRegel,
  removeVerbruikRegel,
  toggleBoete,
  toggleExtraProduct,
  approveReservation,
  toggleRecreatexVerwerkt,
} from "@/app/(app)/controle/actions";

function Pill({ tone, children }: { tone: "amber" | "green"; children: React.ReactNode }) {
  const tones = { amber: "bg-[#FDF0DA] text-[#B4741A]", green: "bg-[#E4F6EE] text-[#1B8E63]" };
  return <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${tones[tone]}`}>{children}</span>;
}

function currency(n: number) {
  return n.toLocaleString("nl-BE", { style: "currency", currency: "EUR" });
}

export default function ReservatieDetail({
  reservation,
  allReservations,
  products,
  productBuildings,
  tellingen,
  leveringen,
  eigenVerbruik,
  boeteProductIds,
  boetes,
  prijzen,
  extraProductIds,
  toegangscodes,
  huurderNaam,
  gebouwNaam,
  canEdit,
  onBack,
  onChanged,
}: {
  reservation: Reservation;
  allReservations: Reservation[];
  products: Product[];
  productBuildings: { product_id: string; building_id: string }[];
  tellingen: Telling[];
  leveringen: VerbruikRegel[];
  eigenVerbruik: VerbruikRegel[];
  boeteProductIds: string[];
  boetes: ReservationBoete[];
  prijzen: ProductPrijs[];
  extraProductIds: string[];
  toegangscodes: ReservationToegangscode[];
  huurderNaam: string;
  gebouwNaam: string;
  canEdit: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [detailModus, setDetailModus] = useState(false);
  const [detailFout, setDetailFout] = useState<string | null>(null);
  // Lokaal bijgehouden, meest recente waarden per product — zodat snel na
  // elkaar tussen frigo/bakken/los wisselen nooit een nog-niet-ververste
  // (verouderde) waarde kan overschrijven, ongeacht hoe snel de pagina zelf
  // ververst na elke opslag.
  const [lokaleDetail, setLokaleDetail] = useState<
    Record<string, { vooraf_frigo: number | null; vooraf_bakken: number | null; vooraf_los: number | null; nadien_frigo: number | null; nadien_bakken: number | null; nadien_los: number | null }>
  >({});
  const [newLevering, setNewLevering] = useState({ productId: products[0]?.id || "", aantal: "", wie: "" });
  const [newEigen, setNewEigen] = useState({ productId: products[0]?.id || "", aantal: "", wie: "" });
  const standaardProducten = useMemo(
    () =>
      products.filter(
        (p) =>
          p.afrekenmodus === "standaard" &&
          productBuildings.some((pb) => pb.building_id === reservation.building_id && pb.product_id === p.id)
      ),
    [products, productBuildings, reservation.building_id]
  );
  // Producten die normaal NIET tot het assortiment van dit gebouw horen (bv.
  // grote flessen) — kunnen per reservatie uitzonderlijk aangevinkt worden.
  const uitzonderlijkeProducten = useMemo(
    () =>
      products.filter(
        (p) =>
          p.afrekenmodus === "standaard" &&
          !productBuildings.some((pb) => pb.building_id === reservation.building_id && pb.product_id === p.id)
      ),
    [products, productBuildings, reservation.building_id]
  );
  const drankProducten = useMemo(
    () => [...standaardProducten, ...uitzonderlijkeProducten.filter((p) => extraProductIds.includes(p.id))],
    [standaardProducten, uitzonderlijkeProducten, extraProductIds]
  );
  const boeteProducten = useMemo(() => products.filter((p) => p.afrekenmodus === "toeslag"), [products]);

  const { perProduct, usedFallback } = useMemo(
    () => computeVerbruik(reservation, allReservations, tellingen, leveringen, eigenVerbruik, drankProducten),
    [reservation, allReservations, tellingen, leveringen, eigenVerbruik, drankProducten]
  );
  const { totaal, boetesTotaal } = useMemo(
    () => computeTotaal(perProduct, drankProducten, boeteProductIds, reservation.begin_datum, prijzen),
    [perProduct, drankProducten, boeteProductIds, reservation.begin_datum, prijzen]
  );

  const anyFallback = Object.values(usedFallback).some(Boolean);

  const resLeveringen = leveringen.filter((l) => l.reservation_id === reservation.id);
  const resEigenVerbruik = eigenVerbruik.filter((l) => l.reservation_id === reservation.id);

  function handleVerenigingNaam(nieuweNaam: string) {
    const trimmed = nieuweNaam.trim();
    if (!trimmed || trimmed === huurderNaam || !reservation.contact_id) return;
    startTransition(async () => {
      await updateContact(reservation.contact_id!, { vereniging: trimmed });
      onChanged();
    });
  }

  function handleSetTelling(productId: string, field: "vooraf" | "nadien", raw: string) {
    const value = raw === "" ? null : Number(raw);
    startTransition(async () => {
      await setTelling(reservation.id, productId, field, value);
      onChanged();
    });
  }

  function handleSetTellingDetail(productId: string, moment: "vooraf" | "nadien", locatie: "frigo" | "bakken" | "los", raw: string, verpakking: number) {
    const value = raw === "" ? null : Number(raw);
    const t = tellingen.find((x) => x.reservation_id === reservation.id && x.product_id === productId);
    const basis = lokaleDetail[productId] ?? {
      vooraf_frigo: t?.vooraf_frigo ?? null,
      vooraf_bakken: t?.vooraf_bakken ?? null,
      vooraf_los: t?.vooraf_los ?? null,
      nadien_frigo: t?.nadien_frigo ?? null,
      nadien_bakken: t?.nadien_bakken ?? null,
      nadien_los: t?.nadien_los ?? null,
    };
    const bijgewerkt = { ...basis, [`${moment}_${locatie}`]: value };
    setLokaleDetail((d) => ({ ...d, [productId]: bijgewerkt }));

    const waarden = {
      frigo: bijgewerkt[`${moment}_frigo`],
      bakken: bijgewerkt[`${moment}_bakken`],
      los: bijgewerkt[`${moment}_los`],
    };
    startTransition(async () => {
      const res = await setTellingDetail(reservation.id, productId, moment, waarden, verpakking);
      if (!res.ok) setDetailFout(res.error);
      else setDetailFout(null);
      onChanged();
    });
  }

  function handleAddLevering() {
    if (!newLevering.productId || !newLevering.aantal) return;
    startTransition(async () => {
      await addVerbruikRegel("levering", {
        reservationId: reservation.id,
        productId: newLevering.productId,
        aantal: Number(newLevering.aantal),
        wie: newLevering.wie,
      });
      setNewLevering({ productId: products[0]?.id || "", aantal: "", wie: "" });
      onChanged();
    });
  }

  function handleAddEigen() {
    if (!newEigen.productId || !newEigen.aantal) return;
    startTransition(async () => {
      await addVerbruikRegel("eigen_verbruik", {
        reservationId: reservation.id,
        productId: newEigen.productId,
        aantal: Number(newEigen.aantal),
        wie: newEigen.wie,
      });
      setNewEigen({ productId: products[0]?.id || "", aantal: "", wie: "" });
      onChanged();
    });
  }

  const [boeteUploadFout, setBoeteUploadFout] = useState<Record<string, string>>({});
  const [boeteBezig, setBoeteBezig] = useState<Record<string, boolean>>({});

  function handleBoeteBestand(productId: string, file: File | null) {
    if (!file) return;
    setBoeteUploadFout((f) => ({ ...f, [productId]: "" }));
    setBoeteBezig((b) => ({ ...b, [productId]: true }));
    startTransition(async () => {
      try {
        const url = await uploadBoeteBewijs(file, reservation.id, productId);
        const res = await toggleBoete(reservation.id, productId, true, url);
        if (!res.ok) setBoeteUploadFout((f) => ({ ...f, [productId]: res.error }));
        else onChanged();
      } catch (e) {
        setBoeteUploadFout((f) => ({ ...f, [productId]: e instanceof Error ? e.message : "Uploaden mislukt." }));
      } finally {
        setBoeteBezig((b) => ({ ...b, [productId]: false }));
      }
    });
  }

  function handleBoeteAfvinken(productId: string) {
    startTransition(async () => {
      await toggleBoete(reservation.id, productId, false);
      onChanged();
    });
  }

  function handleToggleExtraProduct(productId: string, checked: boolean) {
    startTransition(async () => {
      await toggleExtraProduct(reservation.id, productId, checked);
      onChanged();
    });
  }

  function handleApprove() {
    startTransition(async () => {
      await approveReservation(reservation.id);
      onChanged();
      onBack();
    });
  }

  function handleDownloadPdf() {
    const prijsPerProduct: Record<string, number> = {};
    for (const p of drankProducten) prijsPerProduct[p.id] = prijsOpDatum(p, reservation.begin_datum, prijzen);
    const boeteRegels = boeteProducten.filter((p) => boeteProductIds.includes(p.id)).map((p) => ({ name: p.name, prijs: p.prijs }));
    genereerReservatiePdf(reservation, huurderNaam, gebouwNaam, drankProducten, tellingen, perProduct, prijsPerProduct, boeteRegels, totaal);
  }

  function handleToggleRecreatex(verwerkt: boolean) {
    startTransition(async () => {
      await toggleRecreatexVerwerkt(reservation.id, verwerkt);
      onChanged();
    });
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-[#6D5AE6] font-medium mb-4 flex items-center gap-1">
        <ChevronRight size={14} className="rotate-180" /> Terug naar overzicht
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          {canEdit && reservation.contact_id ? (
            <input
              defaultValue={huurderNaam}
              onBlur={(e) => handleVerenigingNaam(e.target.value)}
              className="text-2xl font-bold text-[#171A2B] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-1 -mx-1 w-full max-w-md"
              title="Wijzig hier de naam — dit wordt onthouden onder Verenigingen &amp; klanten voor volgende uploads."
            />
          ) : (
            <h1 className="text-2xl font-bold text-[#171A2B]">{huurderNaam}</h1>
          )}
          <p className="text-[#8A8FA8] text-sm">
            {gebouwNaam} · {formatDate(reservation.begin_datum)} · {reservation.activiteit || "—"}
          </p>
        </div>
        {reservation.status === "wacht" ? (
          <Pill tone="amber">Actie nodig</Pill>
        ) : reservation.recreatex_verwerkt ? (
          <Pill tone="green">Verwerkt in Recreatex</Pill>
        ) : (
          <Pill tone="amber">Klaar voor Recreatex</Pill>
        )}
      </div>

      {reservation.status === "gecontroleerd" && (
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold text-sm text-[#171A2B]">Recreatex</div>
            <p className="text-xs text-[#8A8FA8]">
              {reservation.recreatex_verwerkt
                ? `Verwerkt door ${reservation.recreatex_verwerkt_door || "?"}${
                    reservation.recreatex_verwerkt_op ? ` op ${formatDateTime(reservation.recreatex_verwerkt_op)}` : ""
                  }`
                : "Nog manueel over te nemen in Recreatex."}
            </p>
          </div>
          {canEdit && (
            <button
              onClick={() => handleToggleRecreatex(!reservation.recreatex_verwerkt)}
              disabled={pending}
              className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                reservation.recreatex_verwerkt ? "border border-[#ECECF3] text-[#8A8FA8]" : "bg-[#6D5AE6] text-white"
              }`}
            >
              {reservation.recreatex_verwerkt ? "Terugzetten" : "Markeer als verwerkt"}
            </button>
          )}
        </div>
      )}

      {canEdit && (
        <div className="mb-6">
          <ToegangscodePaneel reservationId={reservation.id} toegangscodes={toegangscodes} onChanged={onChanged} />
        </div>
      )}

      {anyFallback && (
        <div className="bg-[#FDF0DA] text-[#8A5A16] text-sm rounded-xl px-4 py-3 mb-6">
          Voor minstens één product ontbreekt een vooraf-telling — de nadien-telling van de vorige reservatie
          in dit gebouw wordt automatisch als vooraf-waarde gebruikt.
        </div>
      )}

      {drankProducten.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-4 text-sm text-[#B0B4CC] mb-6">
          Dit gebouw heeft nog geen standaard-productassortiment ingesteld (zie Producten & prijzen).
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-6">
          <div className="px-5 pt-3 flex items-center justify-between">
            <button
              onClick={() => setDetailModus((v) => !v)}
              className="text-xs font-semibold text-[#6D5AE6] flex items-center gap-1"
            >
              {detailModus ? "Eenvoudige weergave" : "Detail per locatie (frigo/bakken/los)"}
            </button>
          </div>
          {detailFout && (
            <div className="mx-5 mt-2 bg-[#FDECEC] border border-[#F5C6C0] rounded-lg px-3 py-2 text-xs text-[#D6493C]">
              Kon niet opslaan: {detailFout}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase">
                {detailModus ? (
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Product</th>
                    <th className="text-left px-2 py-3 font-semibold">Voor frigo</th>
                    <th className="text-left px-2 py-3 font-semibold">Voor bakken</th>
                    <th className="text-left px-2 py-3 font-semibold">Voor los</th>
                    <th className="text-left px-2 py-3 font-semibold">Na frigo</th>
                    <th className="text-left px-2 py-3 font-semibold">Na bakken</th>
                    <th className="text-left px-2 py-3 font-semibold">Na los</th>
                    <th className="text-left px-4 py-3 font-semibold">Verbruik</th>
                    <th className="text-left px-4 py-3 font-semibold">Bedrag</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="text-left px-5 py-3 font-semibold">Product</th>
                    <th className="text-left px-5 py-3 font-semibold">Vooraf</th>
                    <th className="text-left px-5 py-3 font-semibold">Nadien</th>
                    <th className="text-left px-5 py-3 font-semibold">Verbruik</th>
                    <th className="text-left px-5 py-3 font-semibold">Bedrag</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {drankProducten.map((p) => {
                  const t = tellingen.find((x) => x.reservation_id === reservation.id && x.product_id === p.id);
                  const q = perProduct[p.id];
                  const isFallback = usedFallback[p.id];

                  if (detailModus) {
                    return (
                      <tr key={p.id} className="border-t border-[#ECECF3]">
                        <td className="px-4 py-2.5 font-medium text-[#171A2B]">{p.name}</td>
                        {(["frigo", "bakken", "los"] as const).map((loc) => (
                          <td key={`v-${loc}`} className="px-2 py-2.5">
                            <input
                              type="number"
                              disabled={!canEdit}
                              defaultValue={lokaleDetail[p.id]?.[`vooraf_${loc}`] ?? t?.[`vooraf_${loc}`] ?? ""}
                              placeholder="0"
                              onBlur={(e) => handleSetTellingDetail(p.id, "vooraf", loc, e.target.value, p.verpakking)}
                              className="w-16 rounded-lg border border-[#ECECF3] px-2 py-1 disabled:bg-[#F7F7FB]"
                            />
                            {loc === "bakken" && <div className="text-[9px] text-[#B0B4CC] mt-0.5">&times;{p.verpakking}</div>}
                          </td>
                        ))}
                        {(["frigo", "bakken", "los"] as const).map((loc) => (
                          <td key={`n-${loc}`} className="px-2 py-2.5">
                            <input
                              type="number"
                              disabled={!canEdit}
                              defaultValue={lokaleDetail[p.id]?.[`nadien_${loc}`] ?? t?.[`nadien_${loc}`] ?? ""}
                              placeholder="0"
                              onBlur={(e) => handleSetTellingDetail(p.id, "nadien", loc, e.target.value, p.verpakking)}
                              className="w-16 rounded-lg border border-[#ECECF3] px-2 py-1 disabled:bg-[#F7F7FB]"
                            />
                            {loc === "bakken" && <div className="text-[9px] text-[#B0B4CC] mt-0.5">&times;{p.verpakking}</div>}
                          </td>
                        ))}
                        <td className="px-4 py-2.5 font-semibold text-[#171A2B]">{q != null ? q : "—"}</td>
                        <td className="px-4 py-2.5 text-[#5B5F82]">{q != null ? currency(q * p.prijs) : "—"}</td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={p.id} className="border-t border-[#ECECF3]">
                      <td className="px-5 py-3 font-medium text-[#171A2B]">{p.name}</td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          disabled={!canEdit}
                          defaultValue={t?.vooraf ?? ""}
                          placeholder={isFallback ? "— (fallback)" : "0"}
                          onBlur={(e) => handleSetTelling(p.id, "vooraf", e.target.value)}
                          className="w-20 rounded-lg border border-[#ECECF3] px-2 py-1 disabled:bg-[#F7F7FB]"
                        />
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="number"
                          disabled={!canEdit}
                          defaultValue={t?.nadien ?? ""}
                          placeholder="0"
                          onBlur={(e) => handleSetTelling(p.id, "nadien", e.target.value)}
                          className="w-20 rounded-lg border border-[#ECECF3] px-2 py-1 disabled:bg-[#F7F7FB]"
                        />
                      </td>
                      <td className="px-5 py-3 font-semibold text-[#171A2B]">{q != null ? q : "—"}</td>
                      <td className="px-5 py-3 text-[#5B5F82]">{q != null ? currency(q * p.prijs) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-5">
          <div className="font-semibold text-[#171A2B] text-sm mb-3">Leveringen tussenin</div>
          {resLeveringen.length === 0 && <p className="text-sm text-[#B0B4CC] mb-2">Geen leveringen geregistreerd.</p>}
          {resLeveringen.map((l) => (
            <div key={l.id} className="flex items-center gap-2 mb-2 text-sm">
              <span className="flex-1">{products.find((p) => p.id === l.product_id)?.name} × {l.aantal}</span>
              <span className="text-[#8A8FA8]">{l.wie}</span>
              {canEdit && (
                <button onClick={() => startTransition(async () => { await removeVerbruikRegel("levering", l.id); onChanged(); })} className="text-[#B0B4CC] hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="flex items-center gap-2 mt-3">
              <select value={newLevering.productId} onChange={(e) => setNewLevering((s) => ({ ...s, productId: e.target.value }))} className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm flex-1">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" value={newLevering.aantal} onChange={(e) => setNewLevering((s) => ({ ...s, aantal: e.target.value }))} className="w-16 rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" placeholder="aantal" />
              <input value={newLevering.wie} onChange={(e) => setNewLevering((s) => ({ ...s, wie: e.target.value }))} className="w-28 rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" placeholder="leverancier" />
              <button onClick={handleAddLevering} disabled={pending} className="text-[#6D5AE6]"><Plus size={16} /></button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-[#ECECF3] p-5">
          <div className="font-semibold text-[#171A2B] text-sm mb-3">Eigen verbruik (personeel/artiesten)</div>
          {resEigenVerbruik.length === 0 && <p className="text-sm text-[#B0B4CC] mb-2">Niets geregistreerd.</p>}
          {resEigenVerbruik.map((l) => (
            <div key={l.id} className="flex items-center gap-2 mb-2 text-sm">
              <span className="flex-1">{products.find((p) => p.id === l.product_id)?.name} × {l.aantal}</span>
              <span className="text-[#8A8FA8]">{l.wie}</span>
              {canEdit && (
                <button onClick={() => startTransition(async () => { await removeVerbruikRegel("eigen_verbruik", l.id); onChanged(); })} className="text-[#B0B4CC] hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {canEdit && (
            <div className="flex items-center gap-2 mt-3">
              <select value={newEigen.productId} onChange={(e) => setNewEigen((s) => ({ ...s, productId: e.target.value }))} className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm flex-1">
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input type="number" value={newEigen.aantal} onChange={(e) => setNewEigen((s) => ({ ...s, aantal: e.target.value }))} className="w-16 rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" placeholder="aantal" />
              <input value={newEigen.wie} onChange={(e) => setNewEigen((s) => ({ ...s, wie: e.target.value }))} className="w-28 rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" placeholder="wie" />
              <button onClick={handleAddEigen} disabled={pending} className="text-[#6D5AE6]"><Plus size={16} /></button>
            </div>
          )}
        </div>
      </div>

      {uitzonderlijkeProducten.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
          <div className="font-semibold text-[#171A2B] text-sm mb-1">Uitzonderlijk aanbod voor deze reservatie</div>
          <p className="text-xs text-[#8A8FA8] mb-4">
            Producten die normaal niet standaard in dit gebouw staan (bv. grote flessen). Aanvinken laat ze
            verschijnen in de telling hierboven, enkel voor deze reservatie.
          </p>
          <div className="grid md:grid-cols-2 gap-2">
            {uitzonderlijkeProducten.map((p) => {
              const checked = extraProductIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer ${
                    checked ? "border-[#6D5AE6] bg-[#EFEBFF]" : "border-[#ECECF3]"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!canEdit}
                    checked={checked}
                    onChange={(e) => handleToggleExtraProduct(p.id, e.target.checked)}
                  />
                  <span className="text-[#171A2B]">{p.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {boeteProducten.length > 0 && (
        <div className="bg-white rounded-2xl border-l-4 border-l-[#D9534F] border border-[#ECECF3] p-5 mb-6">
          <div className="font-semibold text-[#171A2B] text-sm mb-1">Boetes en toeslagen</div>
          <p className="text-xs text-[#8A8FA8] mb-4">
            Vink enkel aan wat voor deze zaalreservatie van toepassing is. Elke boete moet gestaafd worden met een
            foto als bewijs.
          </p>
          <div className="grid md:grid-cols-2 gap-2">
            {boeteProducten.map((p) => {
              const boete = boetes.find((b) => b.product_id === p.id);
              const checked = !!boete;
              const bezig = !!boeteBezig[p.id];
              const fout = boeteUploadFout[p.id];
              return (
                <div key={p.id} className={`rounded-lg border px-3 py-2 text-sm ${checked ? "border-[#D9534F] bg-[#FCEDEC]" : "border-[#ECECF3]"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[#171A2B]">{p.name}</span>
                    <span className="text-[#5B5F82] font-medium">{currency(p.prijs)}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    {checked ? (
                      <>
                        {boete?.bewijs_url && (
                          <a href={boete.bewijs_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#6D5AE6] font-semibold underline">
                            Bewijs bekijken
                          </a>
                        )}
                        {canEdit && (
                          <button onClick={() => handleBoeteAfvinken(p.id)} className="text-xs text-[#8A8FA8] font-semibold">
                            Verwijderen
                          </button>
                        )}
                      </>
                    ) : (
                      canEdit && (
                        <label className="text-xs text-[#6D5AE6] font-semibold cursor-pointer">
                          {bezig ? "Bezig\u2026" : "+ Foto als bewijs toevoegen"}
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            disabled={bezig}
                            onChange={(e) => handleBoeteBestand(p.id, e.target.files?.[0] || null)}
                            className="hidden"
                          />
                        </label>
                      )
                    )}
                  </div>
                  {fout && <div className="text-[11px] text-[#D6493C] mt-1">{fout}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-[#8A8FA8] font-semibold">Voorstel eindbedrag</div>
          <div className="text-2xl font-bold text-[#171A2B]">{currency(totaal)}</div>
          {boetesTotaal > 0 && <div className="text-xs text-[#8A8FA8] mt-0.5">waarvan {currency(boetesTotaal)} boetes/toeslagen</div>}
        </div>
        {canEdit && reservation.status === "wacht" && (
          <button onClick={handleApprove} disabled={pending} className="px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
            <CheckCircle2 size={15} /> Goedkeuren
          </button>
        )}
        <button onClick={handleDownloadPdf} className="px-4 py-2 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#171A2B] flex items-center gap-2">
          <Download size={15} /> PDF genereren
        </button>
      </div>
    </div>
  );
}
