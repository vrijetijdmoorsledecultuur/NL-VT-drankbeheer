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

type Step = "moment" | "gebouw" | "telplek" | "vaste_voorraad" | "reservatie" | "tellen" | "klaar";
type TelFase = "frigo" | "berging";
type DetailTelling = { frigo: number; bakken: number; los: number };

export default function TellerApp({
  token,
  gebouwen,
  defaultNaam = "",
  initialType,
}: {
  token: string;
  gebouwen: TellerGebouw[];
  defaultNaam?: string;
  initialType?: "vooraf" | "nadien" | "controle";
}) {
  const [step, setStep] = useState<Step>(initialType ? (gebouwen.length === 1 ? "telplek" : "gebouw") : "moment");
  const [gebouw, setGebouw] = useState<TellerGebouw | null>(gebouwen.length === 1 ? gebouwen[0] : null);

  const [telplekken, setTelplekken] = useState<TellerTelplek[]>([]);
  const [telplek, setTelplek] = useState<TellerTelplek | null>(null);
  const [loadingTelplekken, setLoadingTelplekken] = useState(false);

  const [vasteVoorraad, setVasteVoorraad] = useState<TellerVasteVoorraadRegel[]>([]);
  const [vasteVoorraadKlopt, setVasteVoorraadKlopt] = useState<boolean | null>(null);

  const [reservations, setReservations] = useState<TellerReservation[]>([]);
  const [reservationId, setReservationId] = useState("");
  const [type, setType] = useState<"vooraf" | "nadien" | "controle">(initialType || "vooraf");
  useEffect(() => {
    if (initialType) {
      setType(initialType);
      setStep(gebouwen.length === 1 ? "telplek" : "gebouw");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialType]);
  const [naam, setNaam] = useState(defaultNaam);

  const [products, setProducts] = useState<TellerProduct[]>([]);
  const [showExtra, setShowExtra] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [detailTellingen, setDetailTellingen] = useState<Record<string, DetailTelling>>({});
  const [telFase, setTelFase] = useState<TelFase>("frigo");
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
      const frigo = list.find((item) => item.naam.toLowerCase().includes("frigo"));
      if (frigo || list[0]) selectTelplek(frigo || list[0]);
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
    setTelFase("frigo");
    setStep("reservatie");
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

  function setDetailAantal(product: TellerProduct, veld: keyof DetailTelling, raw: number) {
    const waarde = Math.max(0, Number.isFinite(raw) ? Math.floor(raw) : 0);
    setDetailTellingen((huidig) => {
      const vorige = huidig[product.id] || { frigo: 0, bakken: 0, los: 0 };
      let volgende = { ...vorige, [veld]: waarde };

      // Losse flesjes boven de bakinhoud worden meteen genormaliseerd.
      if (veld === "los" && product.verpakking > 1 && volgende.los >= product.verpakking) {
        volgende = {
          ...volgende,
          bakken: volgende.bakken + Math.floor(volgende.los / product.verpakking),
          los: volgende.los % product.verpakking,
        };
      }

      const totaal = volgende.frigo + volgende.bakken * Math.max(product.verpakking, 1) + volgende.los;
      setAmounts((aantallen) => ({ ...aantallen, [product.id]: totaal }));
      return { ...huidig, [product.id]: volgende };
    });
    setAfwijkingBevestigd(false);
  }

  async function handleSubmit() {
    if (type !== "controle" && !reservationId) {
      setError("Kies eerst een reservatie.");
      return;
    }
    if (conflicts.length > 0 && !afwijkingBevestigd) {
      setError("Bevestig eerst dat je de gemarkeerde aantallen hebt nagekeken.");
      return;
    }
    setError(null);
    setSubmitting(true);
    // Ook nulwaarden worden bewaard: een lege frigo kan correct geteld zijn.
    const regels = products.map((product) => {
      const detail = detailTellingen[product.id] || { frigo: 0, bakken: 0, los: 0 };
      return { productId: product.id, aantal: amounts[product.id] ?? 0, ...detail };
    });

    const res = await submitTelling(token, {
      buildingId: gebouw!.id,
      telplekId: telplek!.id,
      reservationId: type === "controle" ? null : reservationId,
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
    setDetailTellingen({});
    setTelFase("frigo");
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

  if (step === "moment") {
    return (
      <div className="min-h-screen bg-[#F7F7FB]">
        {header}
        <div className="p-4 max-w-lg mx-auto">
          <div className="text-sm font-semibold text-[#8A8FA8] mb-3">Wat wil je doen?</div>
          <div className="space-y-2">
            <button
              onClick={() => {
                setType("vooraf");
                setStep(gebouwen.length === 1 ? "telplek" : "gebouw");
              }}
              className="w-full text-left bg-white rounded-2xl border border-[#ECECF3] px-5 py-4 hover:border-[#D8D3F7] flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-[#171A2B]">Telling VOORAF</div>
                <div className="text-xs text-[#8A8FA8] mt-0.5">Voor het begin van een activiteit, per reservatie.</div>
              </div>
              <ChevronRight size={16} className="text-[#C7CAE0]" />
            </button>
            <button
              onClick={() => {
                setType("nadien");
                setStep(gebouwen.length === 1 ? "telplek" : "gebouw");
              }}
              className="w-full text-left bg-white rounded-2xl border border-[#ECECF3] px-5 py-4 hover:border-[#D8D3F7] flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-[#171A2B]">Telling ACHTERAF</div>
                <div className="text-xs text-[#8A8FA8] mt-0.5">Na afloop van een activiteit, per reservatie.</div>
              </div>
              <ChevronRight size={16} className="text-[#C7CAE0]" />
            </button>
            <button
              onClick={() => {
                setType("controle");
                setStep(gebouwen.length === 1 ? "telplek" : "gebouw");
              }}
              className="w-full text-left bg-white rounded-2xl border border-[#ECECF3] px-5 py-4 hover:border-[#D8D3F7] flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-[#171A2B]">CONTROLETELLING</div>
                <div className="text-xs text-[#8A8FA8] mt-0.5">Los van een reservatie, gewoon de fysieke voorraad checken.</div>
              </div>
              <ChevronRight size={16} className="text-[#C7CAE0]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "gebouw") {
    return (
      <div className="min-h-screen bg-[#F7F7FB]">
        {header}
        <div className="p-4 max-w-lg mx-auto space-y-2">
          <button onClick={() => setStep("moment")} className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1 mb-1">
            <ChevronLeft size={14} /> Terug
          </button>
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
            onClick={() => setStep("gebouw")}
            className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1 mb-4"
          >
            <ChevronLeft size={14} /> Ander gebouw
          </button>
          <div className="bg-white rounded-2xl border border-[#ECECF3] p-4">
            <div className="text-xs font-semibold text-[#6D5AE6] uppercase tracking-wide mb-3">
              {type === "vooraf" ? "Telling vooraf" : type === "nadien" ? "Telling achteraf" : "Controletelling"}
            </div>

            {type === "controle" ? (
              <p className="text-[11px] text-[#8A8FA8]">
                Een controletelling verifieert de fysieke voorraad, los van een specifieke reservatie.
              </p>
            ) : (
              <>
                <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide block">Reservatie</label>
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
              </>
            )}

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
              onClick={() => (type === "controle" || reservationId) && setStep("tellen")}
              disabled={type !== "controle" && !reservationId}
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
          onClick={() => (telFase === "berging" ? setTelFase("frigo") : setStep("reservatie"))}
          className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1"
        >
          <ChevronLeft size={14} /> Terug
        </button>

        <div className="bg-[#12172B] text-white rounded-2xl px-4 py-4">
          <div className="text-[11px] font-semibold tracking-wide text-[#B9BEDA] uppercase">
            Stap {telFase === "frigo" ? "1 van 2" : "2 van 2"}
          </div>
          <div className="font-bold mt-0.5">
            {telFase === "frigo" ? "In frigo — flesjes/flessen" : "In koelcel of drankberging"}
          </div>
          <p className="text-xs text-[#B9BEDA] mt-1">
            {telFase === "frigo"
              ? "Tel hier enkel de losse flesjes of flessen. Een echte nul mag je gewoon als 0 laten staan."
              : "Vul per product de volle bakken en de resterende losse flesjes in."}
          </p>
        </div>

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
                const detail = detailTellingen[p.id] || { frigo: 0, bakken: 0, los: 0 };
                const vooraf = voorafReferentie[p.id];
                const hasConflict = type === "nadien" && vooraf !== undefined && value > vooraf;
                return (
                  <div key={p.id} className={`px-4 py-3 ${hasConflict ? "bg-[#FDECEC]" : ""}`}>
                    <div className="text-sm font-medium text-[#171A2B] mb-2">{p.name}</div>
                    <div className={`grid ${telFase === "frigo" || p.verpakking <= 1 ? "grid-cols-1" : "grid-cols-2"} gap-2`}>
                      {(telFase === "frigo" ? (["frigo"] as const) : p.verpakking > 1 ? (["bakken", "los"] as const) : (["los"] as const)).map((veld) => {
                        const aantal = detail[veld];
                        const label = veld === "frigo" ? "Flesjes / flessen" : veld === "bakken" ? "Volle bakken" : "Losse flesjes";
                        return (
                          <div key={veld} className="rounded-xl bg-[#F7F7FB] border border-[#ECECF3] p-2">
                            <div className="text-[10px] font-semibold text-[#8A8FA8] uppercase mb-1.5">
                              {label}{veld === "bakken" && p.verpakking > 1 ? ` (×${p.verpakking})` : ""}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                aria-label={`${label} verminderen voor ${p.name}`}
                                onClick={() => setDetailAantal(p, veld, aantal - 1)}
                                className="w-8 h-8 rounded-lg bg-white border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                aria-label={`${label} voor ${p.name}`}
                                type="number"
                                min={0}
                                inputMode="numeric"
                                value={aantal}
                                onChange={(e) => setDetailAantal(p, veld, Number(e.target.value))}
                                className="w-16 text-center text-base font-bold border border-[#ECECF3] rounded-lg py-1.5"
                              />
                              <button
                                type="button"
                                aria-label={`${label} verhogen voor ${p.name}`}
                                onClick={() => setDetailAantal(p, veld, aantal + 1)}
                                className="w-8 h-8 rounded-lg bg-white border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
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

        {telFase === "berging" && conflicts.length > 0 && (
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
            onClick={() => {
              if (telFase === "frigo") {
                setTelFase("berging");
                window.scrollTo({ top: 0, behavior: "smooth" });
              } else {
                handleSubmit();
              }
            }}
            disabled={submitting || (telFase === "berging" && conflicts.length > 0 && !afwijkingBevestigd)}
            className="w-full py-3 rounded-xl bg-[#6D5AE6] text-white font-semibold disabled:opacity-50"
          >
            {submitting
              ? "Bezig met versturen\u2026"
              : telFase === "frigo"
                ? "Verder naar koelcel / drankberging"
                : "Telling versturen"}
          </button>
        </div>
      </div>
    </div>
  );
}
