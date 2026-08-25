"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Minus, Plus, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  getTelplekken,
  getTelplekProducten,
  getVasteVoorraad,
  getReservaties,
  getVoorafReferentie,
  submitTelling,
  type TellerGebouw,
  type TellerTelplek,
  type TellerProduct,
  type TellerVasteVoorraadRegel,
  type TellerReservation,
} from "@/app/tellen/[token]/actions";

type Step = "gebouw" | "telplek" | "vaste_voorraad" | "reservatie" | "tellen" | "klaar";

export default function TellerApp({
  token,
  gebouwen,
  defaultNaam = "",
}: {
  token: string;
  gebouwen: TellerGebouw[];
  defaultNaam?: string;
}) {
  const [step, setStep] = useState<Step>(gebouwen.length === 1 ? "telplek" : "gebouw");
  const [gebouw, setGebouw] = useState<TellerGebouw | null>(gebouwen.length === 1 ? gebouwen[0] : null);

  const [telplekken, setTelplekken] = useState<TellerTelplek[]>([]);
  const [telplek, setTelplek] = useState<TellerTelplek | null>(null);
  const [loadingTelplekken, setLoadingTelplekken] = useState(false);

  const [vasteVoorraad, setVasteVoorraad] = useState<TellerVasteVoorraadRegel[]>([]);
  const [vasteVoorraadKlopt, setVasteVoorraadKlopt] = useState<boolean | null>(null);

  const [reservations, setReservations] = useState<TellerReservation[]>([]);
  const [reservationId, setReservationId] = useState("");
  const [type, setType] = useState<"vooraf" | "nadien">("vooraf");
  const [naam, setNaam] = useState(defaultNaam);

  const [products, setProducts] = useState<TellerProduct[]>([]);
  const [showExtra, setShowExtra] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [voorafReferentie, setVoorafReferentie] = useState<Record<string, number>>({});
  const [afwijkingBevestigd, setAfwijkingBevestigd] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gebouw gekozen (of enige optie) -> telplekken ophalen
  useEffect(() => {
    if (!gebouw) return;
    setLoadingTelplekken(true);
    getTelplekken(token, gebouw.id).then((list) => {
      setTelplekken(list);
      setLoadingTelplekken(false);
      if (list.length === 1) selectTelplek(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gebouw]);

  async function selectTelplek(t: TellerTelplek) {
    setTelplek(t);
    setVasteVoorraadKlopt(null);
    const [prods, res] = await Promise.all([
      getTelplekProducten(token, t.id),
      getReservaties(token, gebouw!.id),
    ]);
    setProducts(prods);
    setReservations(res);
    if (t.heeft_vaste_voorraad) {
      const vv = await getVasteVoorraad(token, t.id);
      setVasteVoorraad(vv);
      setStep("vaste_voorraad");
    } else {
      setStep("reservatie");
    }
  }

  function bevestigVasteVoorraad(klopt: boolean) {
    setVasteVoorraadKlopt(klopt);
    if (klopt) {
      const prefill: Record<string, number> = {};
      for (const r of vasteVoorraad) prefill[r.product_id] = r.aantal;
      setAmounts((a) => ({ ...a, ...prefill }));
    }
    setStep("reservatie");
  }

  // Bij "nadien" + gekozen reservatie: vooraf-referentie ophalen voor de live-check
  useEffect(() => {
    setAfwijkingBevestigd(false);
    if (type !== "nadien" || !reservationId) {
      setVoorafReferentie({});
      return;
    }
    let cancelled = false;
    getVoorafReferentie(token, reservationId).then((map) => {
      if (!cancelled) setVoorafReferentie(map);
    });
    return () => {
      cancelled = true;
    };
  }, [token, reservationId, type]);

  const standaardProducten = products.filter((p) => p.standaard);
  const extraProducten = products.filter((p) => !p.standaard);

  const grouped = useMemo(() => {
    const list = showExtra ? [...standaardProducten, ...extraProducten] : standaardProducten;
    const map = new Map<string, TellerProduct[]>();
    for (const p of list) {
      if (!map.has(p.categorie)) map.set(p.categorie, []);
      map.get(p.categorie)!.push(p);
    }
    return Array.from(map.entries());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, showExtra]);

  const conflicts = useMemo(() => {
    if (type !== "nadien") return [];
    return products
      .filter((p) => voorafReferentie[p.id] !== undefined && (amounts[p.id] ?? 0) > voorafReferentie[p.id])
      .map((p) => ({ product: p, vooraf: voorafReferentie[p.id], nadien: amounts[p.id] ?? 0 }));
  }, [type, products, voorafReferentie, amounts]);

  function setAmount(productId: string, val: number) {
    setAmounts((a) => ({ ...a, [productId]: Math.max(0, val) }));
    setAfwijkingBevestigd(false);
  }

  async function handleSubmit() {
    if (!reservationId) {
      setError("Kies eerst een reservatie.");
      return;
    }
    if (conflicts.length > 0 && !afwijkingBevestigd) {
      setError("Bevestig eerst dat je de gemarkeerde aantallen hebt nagekeken.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const regels = Object.entries(amounts)
      .filter(([, aantal]) => aantal > 0)
      .map(([productId, aantal]) => ({ productId, aantal }));

    const res = await submitTelling(token, {
      buildingId: gebouw!.id,
      telplekId: telplek!.id,
      reservationId,
      type,
      ingevoerdDoor: naam,
      regels,
      afwijkingBevestigd: conflicts.length > 0 && afwijkingBevestigd,
      vasteVoorraadBevestigd: vasteVoorraadKlopt === true,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Er ging iets mis, probeer opnieuw.");
      return;
    }
    setStep("klaar");
  }

  function opnieuw() {
    setStep(gebouwen.length === 1 ? "telplek" : "gebouw");
    setTelplek(null);
    setReservationId("");
    setAmounts({});
    setVasteVoorraadKlopt(null);
    setShowExtra(false);
    setError(null);
  }

  const header = (
    <div className="bg-[#12172B] text-white px-5 py-5">
      <div className="text-[11px] font-semibold tracking-wide text-[#B9BEDA] uppercase">Tellingen</div>
      <div className="text-lg font-bold">
        {gebouw?.name || "Kies je gebouw"}
        {telplek && <span className="text-[#B9BEDA] font-normal"> &middot; {telplek.naam}</span>}
      </div>
    </div>
  );

  if (step === "klaar") {
    return (
      <div className="min-h-screen bg-[#F7F7FB] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-8 max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-[#E4F6EE] text-[#1FAE7A] flex items-center justify-center mx-auto mb-4">
            <Check size={22} />
          </div>
          <div className="font-bold text-[#171A2B] mb-2">Telling verstuurd</div>
          <p className="text-sm text-[#8A8FA8] mb-5">
            Bedankt! Een beheerder controleert je telling. Ze telt pas mee zodra ze is goedgekeurd.
          </p>
          <button onClick={opnieuw} className="text-sm font-semibold text-[#6D5AE6]">
            Nog een telling invoeren
          </button>
        </div>
      </div>
    );
  }

  if (step === "gebouw") {
    return (
      <div className="min-h-screen bg-[#F7F7FB]">
        {header}
        <div className="p-4 max-w-lg mx-auto space-y-2">
          {gebouwen.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                setGebouw(g);
                setStep("telplek");
              }}
              className="w-full flex items-center justify-between bg-white rounded-2xl border border-[#ECECF3] px-5 py-4 text-left hover:border-[#D8D3F7]"
            >
              <span className="font-semibold text-[#171A2B]">{g.name}</span>
              <ChevronRight size={16} className="text-[#C7CAE0]" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "telplek") {
    return (
      <div className="min-h-screen bg-[#F7F7FB]">
        {header}
        <div className="p-4 max-w-lg mx-auto space-y-2">
          {gebouwen.length > 1 && (
            <button
              onClick={() => {
                setGebouw(null);
                setStep("gebouw");
              }}
              className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1 mb-2"
            >
              <ChevronLeft size={14} /> Ander gebouw
            </button>
          )}
          {loadingTelplekken && <div className="text-sm text-[#8A8FA8] text-center py-6">Laden&hellip;</div>}
          {!loadingTelplekken && telplekken.length === 0 && (
            <div className="text-sm text-[#8A8FA8] text-center py-6">
              Voor dit gebouw zijn nog geen telplekken ingesteld.
            </div>
          )}
          {telplekken.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTelplek(t)}
              className="w-full flex items-center justify-between bg-white rounded-2xl border border-[#ECECF3] px-5 py-4 text-left hover:border-[#D8D3F7]"
            >
              <div>
                <span className="font-semibold text-[#171A2B]">{t.naam}</span>
                {t.vereist_naam && (
                  <div className="text-xs text-[#C9862A] mt-0.5">Tel bij voorkeur eerst {t.vereist_naam}</div>
                )}
              </div>
              <ChevronRight size={16} className="text-[#C7CAE0]" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "vaste_voorraad" && telplek) {
    return (
      <div className="min-h-screen bg-[#F7F7FB]">
        {header}
        <div className="p-4 max-w-lg mx-auto">
          <button
            onClick={() => setStep("telplek")}
            className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1 mb-4"
          >
            <ChevronLeft size={14} /> Andere telplek
          </button>
          <div className="bg-white rounded-2xl border border-[#ECECF3] p-5">
            <div className="font-bold text-[#171A2B] mb-1">Vaste voorraad {telplek.naam}</div>
            <p className="text-xs text-[#8A8FA8] mb-4">
              Dit hoort standaard aanwezig te zijn. Klopt dit nog, dan hoef je het niet zelf te tellen.
            </p>
            <div className="divide-y divide-[#ECECF3] mb-5">
              {vasteVoorraad.length === 0 && (
                <div className="text-sm text-[#B0B4CC] py-3">Nog geen vaste voorraad ingesteld door de beheerder.</div>
              )}
              {vasteVoorraad.map((r) => (
                <div key={r.product_id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-[#171A2B]">{r.name}</span>
                  <span className="font-semibold text-[#171A2B]">{r.aantal}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => bevestigVasteVoorraad(true)}
                className="flex-1 py-2.5 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold"
              >
                Ja, dit klopt
              </button>
              <button
                onClick={() => bevestigVasteVoorraad(false)}
                className="flex-1 py-2.5 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#171A2B]"
              >
                Nee, ik tel zelf
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === "reservatie") {
    return (
      <div className="min-h-screen bg-[#F7F7FB]">
        {header}
        <div className="p-4 max-w-lg mx-auto">
          <button
            onClick={() => setStep(telplek?.heeft_vaste_voorraad ? "vaste_voorraad" : "telplek")}
            className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1 mb-4"
          >
            <ChevronLeft size={14} /> Terug
          </button>
          <div className="bg-white rounded-2xl border border-[#ECECF3] p-4">
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Reservatie</label>
            <select
              value={reservationId}
              onChange={(e) => setReservationId(e.target.value)}
              className="w-full mt-2 rounded-lg border border-[#ECECF3] px-3 py-2.5 text-sm"
            >
              <option value="">Kies een reservatie&hellip;</option>
              {reservations.map((r) => (
                <option key={r.id} value={r.id}>
                  {formatDate(r.begin_datum)} &middot; {r.huurder}
                  {r.ruimte ? ` (${r.ruimte})` : ""}
                </option>
              ))}
            </select>

            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide mt-4 block">Moment</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(["vooraf", "nadien"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`py-2.5 rounded-lg text-sm font-semibold border ${
                    type === t ? "bg-[#6D5AE6] text-white border-[#6D5AE6]" : "bg-white text-[#171A2B] border-[#ECECF3]"
                  }`}
                >
                  {t === "vooraf" ? "Vooraf" : "Nadien"}
                </button>
              ))}
            </div>

            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide mt-4 block">
              Jouw naam (optioneel)
            </label>
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Bv. Marie"
              className="w-full mt-2 rounded-lg border border-[#ECECF3] px-3 py-2.5 text-sm"
            />

            <button
              onClick={() => reservationId && setStep("tellen")}
              disabled={!reservationId}
              className="w-full mt-5 py-2.5 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
            >
              Verder naar tellen
            </button>
          </div>
        </div>
      </div>
    );
  }

  // step === "tellen"
  return (
    <div className="min-h-screen bg-[#F7F7FB] pb-28">
      {header}
      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <button
          onClick={() => setStep("reservatie")}
          className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1"
        >
          <ChevronLeft size={14} /> Terug
        </button>

        {vasteVoorraadKlopt && (
          <div className="bg-[#E4F6EE] border border-[#BFE9D5] rounded-xl px-4 py-2.5 text-xs text-[#1B8E63]">
            Vaste voorraad van {telplek?.naam} vooraf ingevuld &mdash; pas gerust aan indien nodig.
          </div>
        )}

        {grouped.map(([categorie, items]) => (
          <div key={categorie} className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-bold text-[#8A8FA8] uppercase tracking-wide bg-[#F7F7FB]">
              {categorie}
            </div>
            <div className="divide-y divide-[#ECECF3]">
              {items.map((p) => {
                const value = amounts[p.id] ?? 0;
                const vooraf = voorafReferentie[p.id];
                const hasConflict = type === "nadien" && vooraf !== undefined && value > vooraf;
                return (
                  <div key={p.id} className={`px-4 py-3 ${hasConflict ? "bg-[#FDECEC]" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#171A2B]">{p.name}</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAmount(p.id, value - 1)}
                          className="w-8 h-8 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={value}
                          onChange={(e) => setAmount(p.id, Number(e.target.value) || 0)}
                          className={`w-12 text-center text-sm font-semibold border rounded-lg py-1.5 ${
                            hasConflict ? "border-[#D6493C] text-[#D6493C]" : "border-[#ECECF3]"
                          }`}
                        />
                        <button
                          onClick={() => setAmount(p.id, value + 1)}
                          className="w-8 h-8 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    {hasConflict && (
                      <div className="text-xs text-[#D6493C] mt-1.5 flex items-center gap-1">
                        <AlertTriangle size={12} /> Vooraf geteld: {vooraf}. Nadien kan niet hoger zijn dan vooraf.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {extraProducten.length > 0 && !showExtra && (
          <button onClick={() => setShowExtra(true)} className="text-sm text-[#6D5AE6] font-semibold">
            + Extra producten nodig voor dit evenement (bv. grote flessen)
          </button>
        )}

        {conflicts.length > 0 && (
          <div className="bg-[#FDECEC] border border-[#F6C6C0] rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#D6493C] mb-1">
              <AlertTriangle size={15} /> Dit kan niet kloppen
            </div>
            <p className="text-xs text-[#8A5850] mb-3">
              Voor {conflicts.length} product(en) is het nadien-aantal hoger dan wat vooraf werd geteld. Tel deze
              producten opnieuw na als je nog ter plaatse bent.
            </p>
            <label className="flex items-start gap-2 text-xs text-[#8A5850]">
              <input
                type="checkbox"
                checked={afwijkingBevestigd}
                onChange={(e) => setAfwijkingBevestigd(e.target.checked)}
                className="mt-0.5"
              />
              Ik heb dit nagekeken en de aantallen kloppen toch (bv. er kwam een extra levering bij).
            </label>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#ECECF3] p-4">
        <div className="max-w-lg mx-auto">
          {error && <div className="text-sm text-[#D6493C] mb-2">{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={submitting || (conflicts.length > 0 && !afwijkingBevestigd)}
            className="w-full py-3 rounded-xl bg-[#6D5AE6] text-white font-semibold disabled:opacity-50"
          >
            {submitting ? "Bezig met versturen\u2026" : "Telling versturen"}
          </button>
        </div>
      </div>
    </div>
  );
}
