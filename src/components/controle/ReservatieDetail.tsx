"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronRight, Plus, Trash2, CheckCircle2, Mail, Copy, Check } from "lucide-react";
import type { Reservation, Product, Telling, VerbruikRegel, ReservationToegangscode } from "@/lib/types";
import { computeVerbruik, computeTotaal } from "@/lib/verbruik";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  setTelling,
  addVerbruikRegel,
  removeVerbruikRegel,
  toggleBoete,
  toggleExtraProduct,
  approveReservation,
  plantToegangscode,
  verstuurToegangscodeNu,
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
  extraProductIds: string[];
  toegangscodes: ReservationToegangscode[];
  huurderNaam: string;
  gebouwNaam: string;
  canEdit: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [newLevering, setNewLevering] = useState({ productId: products[0]?.id || "", aantal: "", wie: "" });
  const [newEigen, setNewEigen] = useState({ productId: products[0]?.id || "", aantal: "", wie: "" });
  const [toegangEmail, setToegangEmail] = useState("");
  const [verstuurOp, setVerstuurOp] = useState("");
  const [geldigTot, setGeldigTot] = useState("");
  const [toegangError, setToegangError] = useState<string | null>(null);
  const [gekopieerdId, setGekopieerdId] = useState<string | null>(null);

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
    () => computeTotaal(perProduct, drankProducten, boeteProductIds),
    [perProduct, drankProducten, boeteProductIds]
  );

  const anyFallback = Object.values(usedFallback).some(Boolean);

  const resLeveringen = leveringen.filter((l) => l.reservation_id === reservation.id);
  const resEigenVerbruik = eigenVerbruik.filter((l) => l.reservation_id === reservation.id);

  function handleSetTelling(productId: string, field: "vooraf" | "nadien", raw: string) {
    const value = raw === "" ? null : Number(raw);
    startTransition(async () => {
      await setTelling(reservation.id, productId, field, value);
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

  function handleToggleBoete(productId: string, checked: boolean) {
    startTransition(async () => {
      await toggleBoete(reservation.id, productId, checked);
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

  function handlePlanToegangscode() {
    setToegangError(null);
    if (!toegangEmail.trim()) {
      setToegangError("Vul een e-mailadres in.");
      return;
    }
    if (!verstuurOp || !geldigTot) {
      setToegangError("Vul zowel het verzendmoment als de geldigheidsdatum in.");
      return;
    }
    startTransition(async () => {
      const res = await plantToegangscode(reservation.id, toegangEmail, verstuurOp, geldigTot);
      if (!res.ok) {
        setToegangError(res.error);
        return;
      }
      setToegangEmail("");
      setVerstuurOp("");
      setGeldigTot("");
      onChanged();
    });
  }

  function kopieerLink(code: string, id: string) {
    const link = `${window.location.origin}/gast/${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setGekopieerdId(id);
      setTimeout(() => setGekopieerdId(null), 2000);
    });
  }

  function handleVerstuurNu(id: string) {
    startTransition(async () => {
      const res = await verstuurToegangscodeNu(id, window.location.origin);
      if (!res.ok) setToegangError(res.error);
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
          <h1 className="text-2xl font-bold text-[#171A2B]">{huurderNaam}</h1>
          <p className="text-[#8A8FA8] text-sm">
            {gebouwNaam} · {formatDate(reservation.begin_datum)} · {reservation.activiteit || "—"}
          </p>
        </div>
        {reservation.status === "wacht" ? <Pill tone="amber">Actie nodig</Pill> : <Pill tone="green">In orde</Pill>}
      </div>

      {canEdit && (
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#E7F0FD] text-[#2F6FCB] flex items-center justify-center shrink-0">
              <Mail size={15} />
            </div>
            <div className="font-bold text-[#171A2B]">Externe toegangscode</div>
          </div>
          <p className="text-xs text-[#8A8FA8] mb-4">
            Voor kleinere activiteiten met &eacute;&eacute;n verantwoordelijke: verstuur automatisch een code
            waarmee die persoon zelf, zonder account, het verbruik van deze reservatie registreert. Telt pas mee
            na goedkeuring, net als bij het poetspersoneel.
          </p>

          {toegangscodes.length > 0 && (
            <div className="divide-y divide-[#ECECF3] mb-4 border border-[#ECECF3] rounded-lg">
              {toegangscodes.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <div>
                    <span className="font-mono font-semibold text-[#171A2B]">{t.code}</span>
                    <span className="text-xs text-[#8A8FA8] ml-2">
                      naar {t.verstuur_email} &middot;{" "}
                      {t.verstuurd ? "verstuurd" : `gepland om ${t.verstuur_op ? formatDateTime(t.verstuur_op) : "?"}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    {!t.verstuurd && (
                      <button
                        onClick={() => handleVerstuurNu(t.id)}
                        disabled={pending}
                        className="text-[11px] font-semibold text-[#6D5AE6] px-2 py-1 rounded-lg border border-[#ECECF3] hover:bg-[#F7F7FB] disabled:opacity-50"
                      >
                        Verstuur nu
                      </button>
                    )}
                    <button onClick={() => kopieerLink(t.code, t.id)} className="text-[#6D5AE6] p-1">
                      {gekopieerdId === t.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">E-mailadres</label>
              <input
                type="email"
                value={toegangEmail}
                onChange={(e) => setToegangEmail(e.target.value)}
                placeholder="verantwoordelijke@voorbeeld.be"
                className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Versturen om</label>
              <input
                type="datetime-local"
                value={verstuurOp}
                onChange={(e) => setVerstuurOp(e.target.value)}
                className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2.5 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Geldig tot</label>
              <input
                type="datetime-local"
                value={geldigTot}
                onChange={(e) => setGeldigTot(e.target.value)}
                className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2.5 py-1.5 text-sm"
              />
            </div>
          </div>
          {toegangError && <div className="text-xs text-[#D6493C] mt-2">{toegangError}</div>}
          <button
            onClick={handlePlanToegangscode}
            disabled={pending}
            className="mt-3 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Bezig\u2026" : "Inplannen"}
          </button>
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
        <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase">
              <tr>
                <th className="text-left px-5 py-3 font-semibold">Product</th>
                <th className="text-left px-5 py-3 font-semibold">Vooraf</th>
                <th className="text-left px-5 py-3 font-semibold">Nadien</th>
                <th className="text-left px-5 py-3 font-semibold">Verbruik</th>
                <th className="text-left px-5 py-3 font-semibold">Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {drankProducten.map((p) => {
                const t = tellingen.find((x) => x.reservation_id === reservation.id && x.product_id === p.id);
                const q = perProduct[p.id];
                const isFallback = usedFallback[p.id];
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
          <p className="text-xs text-[#8A8FA8] mb-4">Vink enkel aan wat voor deze zaalreservatie van toepassing is.</p>
          <div className="grid md:grid-cols-2 gap-2">
            {boeteProducten.map((p) => {
              const checked = boeteProductIds.includes(p.id);
              return (
                <label key={p.id} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm cursor-pointer ${checked ? "border-[#D9534F] bg-[#FCEDEC]" : "border-[#ECECF3]"}`}>
                  <span className="flex items-center gap-2 text-[#171A2B]">
                    <input type="checkbox" disabled={!canEdit} checked={checked} onChange={(e) => handleToggleBoete(p.id, e.target.checked)} />
                    {p.name}
                  </span>
                  <span className="text-[#5B5F82] font-medium">{currency(p.prijs)}</span>
                </label>
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
      </div>
    </div>
  );
}
