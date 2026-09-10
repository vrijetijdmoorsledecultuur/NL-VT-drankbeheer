"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Users, Trash2, Minus, Plus, ArrowLeftRight, FileText, ChevronDown, ChevronUp, Download } from "lucide-react";
import type { Building, Reservation, Product, VerbruikRegel, ProductPrijs, Factuur, FactuurRegel } from "@/lib/types";
import { addVerbruikRegel, removeVerbruikRegel } from "@/app/(app)/controle/actions";
import { addVerplaatsing, createFactuur } from "@/app/(app)/verwerking/actions";
import { formatDate } from "@/lib/format";
import { prijsOpDatum } from "@/lib/verbruik";
import { genereerFactuurPdf } from "@/lib/genereerFactuurPdf";

type Kind = "levering" | "eigen_verbruik" | "verplaatsing" | "factuur";
type Mode = "gekoppeld" | "los";
type Eenheid = "stuk" | "bak";
type FactuurType = "factuur" | "creditnota";

export default function SnelleVerwerkingView({
  buildings,
  reservations,
  products,
  productBuildingLinks,
  recentLeveringen,
  recentEigenVerbruik,
  prijzen,
  facturen,
  factuurRegels,
  canEdit,
  allowLeveringen = true,
  initialKind,
}: {
  buildings: Building[];
  reservations: Reservation[];
  products: Product[];
  productBuildingLinks: { product_id: string; building_id: string; volgorde: number }[];
  recentLeveringen: VerbruikRegel[];
  recentEigenVerbruik: VerbruikRegel[];
  prijzen: ProductPrijs[];
  facturen: Factuur[];
  factuurRegels: FactuurRegel[];
  canEdit: boolean;
  allowLeveringen?: boolean;
  initialKind?: Kind;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initialKind || "eigen_verbruik");

  // De pagina zelf verandert niet van route bij het wisselen tussen "Intern
  // gebruik" en "Factuur / creditnota" (enkel de querystring) — React start
  // dit component dus niet automatisch opnieuw op. Volg de prop expliciet op
  // zodat de juiste modus altijd overeenkomt met de link waarop geklikt werd.
  useEffect(() => {
    setKind(initialKind || "eigen_verbruik");
  }, [initialKind]);
  const isFactuurContext = initialKind === "factuur";
  const [mode, setMode] = useState<Mode>("los");
  const [reservationId, setReservationId] = useState("");
  const [buildingId, setBuildingId] = useState(buildings[0]?.id || "");
  const [vanBuildingId, setVanBuildingId] = useState(buildings[0]?.id || "");
  const [naarBuildingId, setNaarBuildingId] = useState(buildings[1]?.id || buildings[0]?.id || "");
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [reden, setReden] = useState("");
  const [wie, setWie] = useState("");
  const [factuurNaam, setFactuurNaam] = useState("");
  const [factuurType, setFactuurType] = useState<FactuurType>("factuur");
  const [factuurGebouwId, setFactuurGebouwId] = useState(buildings[0]?.id || "");
  // aantal wordt altijd bewaard in individuele eenheden (stuks)
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  // per product: in welke eenheid de gebruiker momenteel invoert
  const [eenheden, setEenheden] = useState<Record<string, Eenheid>>({});
  const [pending, startTransition] = useTransition();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Welk gebouw bepaalt op dit moment de productenlijst + volgorde?
  const actiefGebouwId =
    kind === "verplaatsing"
      ? vanBuildingId
      : kind === "factuur"
      ? factuurGebouwId
      : mode === "los"
      ? buildingId
      : reservations.find((r) => r.id === reservationId)?.building_id || "";

  // Op welke datum gold de prijs die getoond/gebruikt moet worden? Bij een
  // koppeling aan een reservatie is dat de datum van de reservatie zelf, niet
  // het los ingevulde datumveld (dat wordt dan niet eens getoond).
  const effectieveDatum = mode === "gekoppeld" && kind !== "verplaatsing" && kind !== "factuur" ? reservations.find((r) => r.id === reservationId)?.begin_datum || datum : datum;

  const scopedProducts = useMemo(() => {
    if (!actiefGebouwId) return products;
    const order = new Map(
      productBuildingLinks.filter((l) => l.building_id === actiefGebouwId).map((l) => [l.product_id, l.volgorde])
    );
    return products
      .filter((p) => order.has(p.id))
      .sort((a, b) => (order.get(a.id)! - order.get(b.id)!) || a.name.localeCompare(b.name));
  }, [products, productBuildingLinks, actiefGebouwId]);

  const recentCombined = useMemo(() => {
    const withKind = [
      ...recentLeveringen.map((r) => ({ ...r, kind: "levering" as const })),
      ...recentEigenVerbruik.map((r) => ({ ...r, kind: "eigen_verbruik" as const })),
    ];
    return withKind.sort((a, b) => (b.datum || "").localeCompare(a.datum || "")).slice(0, 15);
  }, [recentLeveringen, recentEigenVerbruik]);

  function eenheidFor(p: Product): Eenheid {
    if (p.verpakking <= 1) return "stuk";
    return eenheden[p.id] ?? "bak";
  }

  function stapFor(p: Product) {
    return eenheidFor(p) === "bak" ? p.verpakking : 1;
  }

  function setAmount(productId: string, val: number) {
    setAmounts((a) => ({ ...a, [productId]: Math.max(0, val) }));
  }

  function wijzig(p: Product, delta: 1 | -1) {
    const stap = stapFor(p);
    const huidig = amounts[p.id] ?? 0;
    setAmount(p.id, huidig + delta * stap);
  }

  function toggleEenheid(p: Product) {
    setEenheden((e) => ({ ...e, [p.id]: eenheidFor(p) === "bak" ? "stuk" : "bak" }));
  }

  const { totaalWaarde, totaalAantal } = useMemo(() => {
    let waarde = 0;
    let aantal = 0;
    for (const p of scopedProducts) {
      const stuks = amounts[p.id] ?? 0;
      waarde += stuks * prijsOpDatum(p, effectieveDatum, prijzen);
      aantal += stuks;
    }
    return { totaalWaarde: waarde, totaalAantal: aantal };
  }, [scopedProducts, amounts, effectieveDatum, prijzen]);

  function handleSave() {
    setError(null);
    const regels = Object.entries(amounts).filter(([, aantal]) => aantal > 0);
    if (regels.length === 0) return;

    if (kind === "factuur" && !factuurNaam.trim()) {
      setError("Vul een naam in (bv. de vereniging of dienst).");
      return;
    }

    startTransition(async () => {
      if (kind === "verplaatsing") {
        for (const [productId, aantal] of regels) {
          await addVerplaatsing({ productId, vanBuildingId, naarBuildingId, aantal, datum, reden, wie });
        }
      } else if (kind === "factuur") {
        const factuurRegels = regels.map(([productId, aantal]) => ({
          productId,
          aantal,
          prijs: (() => {
            const product = products.find((p) => p.id === productId);
            return product ? prijsOpDatum(product, datum, prijzen) : 0;
          })(),
        }));
        await createFactuur({ buildingId: factuurGebouwId, naam: factuurNaam, type: factuurType, datum, regels: factuurRegels, wie });
      } else {
        for (const [productId, aantal] of regels) {
          await addVerbruikRegel(kind, {
            reservationId: mode === "gekoppeld" ? reservationId : null,
            buildingId: mode === "los" ? buildingId : null,
            datum: mode === "los" ? datum : null,
            productId,
            aantal,
            wie,
          });
        }
      }
      setAmounts({});
      if (kind === "factuur") setFactuurNaam("");
      setSavedMsg(`${regels.length} product(en) geregistreerd.`);
      router.refresh();
      setTimeout(() => setSavedMsg(null), 3000);
    });
  }

  function handleDelete(entryKind: "levering" | "eigen_verbruik", id: string) {
    startTransition(async () => {
      await removeVerbruikRegel(entryKind, id);
      router.refresh();
    });
  }

  if (!canEdit) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-[#171A2B] mb-1">{isFactuurContext ? "Factuur / creditnota" : "Intern gebruik"}</h1>
        <p className="text-[#8A8FA8] text-sm">Je hebt geen rechten om verbruik te registreren.</p>
      </div>
    );
  }

  const kanOpslaan =
    totaalAantal > 0 &&
    (kind === "verplaatsing"
      ? !!vanBuildingId && !!naarBuildingId && vanBuildingId !== naarBuildingId
      : kind === "factuur"
      ? !!factuurNaam.trim()
      : !(mode === "gekoppeld" && !reservationId));

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-1">{isFactuurContext ? "Factuur / creditnota" : "Intern gebruik"}</h1>
      <p className="text-[#8A8FA8] text-sm mb-6">
        {isFactuurContext
          ? "Registreer een eenvoudige factuur of creditnota voor een externe partij."
          : "Registreer eigen verbruik, een levering, of een verplaatsing — interne boekhouding, hier wordt nooit een factuur voor opgemaakt."}
      </p>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-4">
            {isFactuurContext ? (
              <div className="mb-4">
                <div className="flex items-center gap-2 py-2.5 px-1 text-sm font-semibold text-[#171A2B]">
                  <FileText size={15} className="text-[#6D5AE6]" /> Factuur / creditnota
                </div>
              </div>
            ) : (
              <div className={`grid gap-2 mb-4 ${allowLeveringen ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1"}`}>
                <button
                  onClick={() => setKind("eigen_verbruik")}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border ${
                    kind === "eigen_verbruik" ? "bg-[#6D5AE6] text-white border-[#6D5AE6]" : "bg-white text-[#171A2B] border-[#ECECF3]"
                  }`}
                >
                  <Users size={15} /> Eigen verbruik
                </button>
                {allowLeveringen && (
                  <>
                    <button
                      onClick={() => setKind("levering")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border ${
                        kind === "levering" ? "bg-[#6D5AE6] text-white border-[#6D5AE6]" : "bg-white text-[#171A2B] border-[#ECECF3]"
                      }`}
                    >
                      <Package size={15} /> Levering
                    </button>
                    <button
                      onClick={() => setKind("verplaatsing")}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold border ${
                        kind === "verplaatsing" ? "bg-[#6D5AE6] text-white border-[#6D5AE6]" : "bg-white text-[#171A2B] border-[#ECECF3]"
                      }`}
                    >
                      <ArrowLeftRight size={15} /> Verplaatsen
                    </button>
                  </>
                )}
              </div>
            )}

            {kind === "verplaatsing" ? (
              <>
                <p className="text-[11px] text-[#8A8FA8] mb-3">
                  Bv. drank waarvan de vervaldatum nadert, overplaatsen naar een gebouw met hoger verbruik.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Van gebouw</label>
                    <select value={vanBuildingId} onChange={(e) => setVanBuildingId(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Naar gebouw</label>
                    <select value={naarBuildingId} onChange={(e) => setNaarBuildingId(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {vanBuildingId === naarBuildingId && <div className="text-xs text-[#D6493C] mt-2">Kies twee verschillende gebouwen.</div>}
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Datum</label>
                    <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Reden (optioneel)</label>
                    <input value={reden} onChange={(e) => setReden(e.target.value)} placeholder="Bv. bijna vervaldatum" className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
                  </div>
                </div>
              </>
            ) : kind === "factuur" ? (
              <>
                <p className="text-[11px] text-[#8A8FA8] mb-3">
                  Voor klein, eenmalig verbruik zonder volledige reservatie (bv. één koffiepad voor een kleine
                  bijeenkomst).
                </p>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => setFactuurType("factuur")}
                    className={`py-2 rounded-lg text-sm font-medium border ${
                      factuurType === "factuur" ? "bg-[#EFEBFF] text-[#6D5AE6] border-[#D8D3F7]" : "bg-white text-[#8A8FA8] border-[#ECECF3]"
                    }`}
                  >
                    Factuur
                  </button>
                  <button
                    onClick={() => setFactuurType("creditnota")}
                    className={`py-2 rounded-lg text-sm font-medium border ${
                      factuurType === "creditnota" ? "bg-[#EFEBFF] text-[#6D5AE6] border-[#D8D3F7]" : "bg-white text-[#8A8FA8] border-[#ECECF3]"
                    }`}
                  >
                    Creditnota
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Naam</label>
                    <input value={factuurNaam} onChange={(e) => setFactuurNaam(e.target.value)} placeholder="Bv. I-mens" className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Gebouw</label>
                    <select value={factuurGebouwId} onChange={(e) => setFactuurGebouwId(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Datum</label>
                  <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    onClick={() => setMode("los")}
                    className={`py-2 rounded-lg text-sm font-medium border ${
                      mode === "los" ? "bg-[#EFEBFF] text-[#6D5AE6] border-[#D8D3F7]" : "bg-white text-[#8A8FA8] border-[#ECECF3]"
                    }`}
                  >
                    Los (gebouw + datum)
                  </button>
                  <button
                    onClick={() => setMode("gekoppeld")}
                    className={`py-2 rounded-lg text-sm font-medium border ${
                      mode === "gekoppeld" ? "bg-[#EFEBFF] text-[#6D5AE6] border-[#D8D3F7]" : "bg-white text-[#8A8FA8] border-[#ECECF3]"
                    }`}
                  >
                    Aan reservatie koppelen
                  </button>
                </div>
                {mode === "gekoppeld" && (
                  <p className="text-[11px] text-[#8A8FA8] -mt-2 mb-3">
                    Handig als er tussen twee activiteiten door niet geteld werd en dit klein verbruik zelf genoteerd werd.
                  </p>
                )}

                {mode === "los" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Gebouw</label>
                      <select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Datum</label>
                      <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Reservatie</label>
                    <select value={reservationId} onChange={(e) => setReservationId(e.target.value)} className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm">
                      <option value="">Kies een reservatie&hellip;</option>
                      {reservations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {formatDate(r.begin_datum)} &middot; {buildings.find((b) => b.id === r.building_id)?.name || "?"}
                          {r.ruimte ? ` (${r.ruimte})` : ""} &middot; {r.huurder}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="mt-3">
              <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Wie (optioneel)</label>
              <input value={wie} onChange={(e) => setWie(e.target.value)} placeholder="Bv. naam personeelslid" className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm" />
            </div>
          </div>

          {actiefGebouwId && <div className="text-xs text-[#8A8FA8] mb-2">Volgorde volgens {buildings.find((b) => b.id === actiefGebouwId)?.name}</div>}
          <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-2.5">
              {scopedProducts.map((p) => {
                const stuks = amounts[p.id] ?? 0;
                const eenheid = eenheidFor(p);
                const stap = stapFor(p);
                const weergaveAantal = eenheid === "bak" ? Math.round(stuks / stap) : stuks;
                const heeftVerpakking = p.verpakking > 1;
                const geselecteerd = stuks > 0;

                return (
                  <div key={p.id} className={`rounded-2xl p-3 ${geselecteerd ? "border-2 border-[#6D5AE6]" : "border border-[#ECECF3]"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-semibold text-[#171A2B] leading-tight">{p.name}</span>
                      <span className="text-xs text-[#8A8FA8] shrink-0 ml-1">&euro;{prijsOpDatum(p, effectieveDatum, prijzen).toFixed(2)}</span>
                    </div>

                    {heeftVerpakking && (
                      <button onClick={() => toggleEenheid(p)} className="text-[10px] font-semibold uppercase tracking-wide text-[#6D5AE6] bg-[#EFEBFF] rounded-full px-2 py-0.5 mb-2 inline-block">
                        {eenheid === "bak" ? `per bak (${p.verpakking})` : "per stuk"}
                      </button>
                    )}

                    <div className="flex items-center justify-between">
                      <button onClick={() => wijzig(p, -1)} className="w-7 h-7 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]">
                        <Minus size={13} />
                      </button>
                      <span className="text-sm font-semibold text-[#171A2B]">{weergaveAantal}</span>
                      <button onClick={() => wijzig(p, 1)} className="w-7 h-7 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]">
                        <Plus size={13} />
                      </button>
                    </div>
                    {heeftVerpakking && eenheid === "bak" && stuks > 0 && <div className="text-[11px] text-[#B0B4CC] text-center mt-1">= {stuks} stuks</div>}
                  </div>
                );
              })}
              {scopedProducts.length === 0 && <div className="col-span-full text-sm text-[#B0B4CC] text-center py-6">Geen producten gekoppeld aan dit gebouw.</div>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#ECECF3] p-4 flex items-center justify-between sticky bottom-4">
            <div>
              <div className="text-xs text-[#8A8FA8]">
                {totaalAantal} stuks{" "}
                {kind === "levering" ? "erbij" : kind === "verplaatsing" ? "verplaatst" : kind === "factuur" ? "" : "eraf"}
              </div>
              <div
                className={`text-lg font-bold ${
                  kind === "levering" || (kind === "factuur" && factuurType === "factuur")
                    ? "text-[#1FAE7A]"
                    : kind === "verplaatsing"
                    ? "text-[#171A2B]"
                    : "text-[#C9862A]"
                }`}
              >
                {kind === "levering" || (kind === "factuur" && factuurType === "factuur")
                  ? "+"
                  : kind === "eigen_verbruik" || (kind === "factuur" && factuurType === "creditnota")
                  ? "\u2212"
                  : ""}
                &euro;{totaalWaarde.toFixed(2)}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {error && <span className="text-sm text-[#D6493C] font-medium">{error}</span>}
              {savedMsg && <span className="text-sm text-[#1FAE7A] font-medium">{savedMsg}</span>}
              <button onClick={handleSave} disabled={pending || !kanOpslaan} className="px-5 py-2.5 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50">
                {pending ? "Bezig\u2026" : "Registreren"}
              </button>
            </div>
          </div>
        </div>

        <div>
          <FacturenPaneel buildings={buildings} products={products} facturen={facturen} factuurRegels={factuurRegels} />

          <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mt-4">
            <div className="px-4 py-3 border-b border-[#ECECF3]">
              <div className="font-bold text-[#171A2B] text-sm">Recent (los)</div>
              <div className="text-xs text-[#8A8FA8] mt-0.5">Laatste losse registraties.</div>
            </div>
            <div className="divide-y divide-[#ECECF3] max-h-[600px] overflow-y-auto">
              {recentCombined.length === 0 && <div className="px-4 py-6 text-sm text-[#B0B4CC] text-center">Nog niets geregistreerd.</div>}
              {recentCombined.map((r) => {
                const product = products.find((p) => p.id === r.product_id);
                const building = buildings.find((b) => b.id === r.building_id);
                const isLevering = r.kind === "levering";
                return (
                  <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#171A2B] truncate">
                        <span className={isLevering ? "text-[#1FAE7A]" : "text-[#C9862A]"}>{isLevering ? "+" : "\u2212"}</span> {product?.name || "?"} &times; {r.aantal}
                      </div>
                      <div className="text-xs text-[#8A8FA8] truncate">
                        {building?.name} &middot; {formatDate(r.datum)} &middot; {isLevering ? "Levering" : "Eigen verbruik"}
                      </div>
                    </div>
                    <button onClick={() => handleDelete(r.kind, r.id)} className="text-[#C7CAE0] hover:text-[#D6493C] shrink-0 ml-2">
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacturenPaneel({
  buildings,
  products,
  facturen,
  factuurRegels,
}: {
  buildings: Building[];
  products: Product[];
  facturen: Factuur[];
  factuurRegels: FactuurRegel[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#ECECF3]">
        <div className="font-bold text-[#171A2B] text-sm">Facturen & creditnota&apos;s</div>
        <div className="text-xs text-[#8A8FA8] mt-0.5">Wacht op goedkeuring in Registraties &middot; controle.</div>
      </div>
      <div className="divide-y divide-[#ECECF3] max-h-[600px] overflow-y-auto">
        {facturen.length === 0 && <div className="px-4 py-6 text-sm text-[#B0B4CC] text-center">Nog geen facturen.</div>}
        {facturen.map((f) => {
          const gebouw = buildings.find((b) => b.id === f.building_id);
          const open = openId === f.id;
          const regels = factuurRegels.filter((r) => r.factuur_id === f.id);
          return (
            <div key={f.id}>
              <button
                onClick={() => setOpenId(open ? null : f.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-[#F7F7FB]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#171A2B] truncate">
                    {f.naam} &middot; {f.type === "creditnota" ? "\u2212" : ""}&euro;{f.bedrag.toFixed(2)}
                  </div>
                  <div className="text-xs text-[#8A8FA8] truncate">
                    {gebouw?.name} &middot; {formatDate(f.datum)}
                    {f.status === "open" ? (
                      <span className="text-[#B4790C]"> &middot; wacht op goedkeuring</span>
                    ) : f.recreatex_verwerkt ? (
                      <span className="text-[#1B8E63]"> &middot; verwerkt in Recreatex</span>
                    ) : (
                      <span className="text-[#2F6FCB]"> &middot; goedgekeurd</span>
                    )}
                  </div>
                </div>
                {open ? <ChevronUp size={14} className="text-[#8A8FA8] shrink-0 ml-2" /> : <ChevronDown size={14} className="text-[#8A8FA8] shrink-0 ml-2" />}
              </button>
              {open && (
                <div className="px-4 pb-3 bg-[#F7F7FB]">
                  <div className="divide-y divide-[#ECECF3] bg-white rounded-lg border border-[#ECECF3]">
                    {regels.map((r) => {
                      const product = products.find((p) => p.id === r.product_id);
                      return (
                        <div key={r.product_id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                          <span className="text-[#171A2B]">{product?.name || "?"}</span>
                          <span className="text-[#5B5F82]">
                            {r.aantal} &times; &euro;{r.prijs.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    {regels.length === 0 && <div className="px-3 py-2 text-xs text-[#B0B4CC]">Geen producten.</div>}
                  </div>
                  {f.status === "goedgekeurd" && (
                    <button
                      onClick={() => genereerFactuurPdf(f, regels, products, gebouw?.name || "?")}
                      className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-[#ECECF3] text-xs font-semibold text-[#171A2B] hover:bg-white"
                    >
                      <Download size={12} /> PDF opnieuw downloaden
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
