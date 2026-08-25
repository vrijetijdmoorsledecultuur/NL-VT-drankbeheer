"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Minus, Copy, Check, Truck, X, Package, Users } from "lucide-react";
import type { Building, Product, Leverancier, Bestelling, BestellingRegel, BestellingStatus } from "@/lib/types";
import { formatDate } from "@/lib/format";
import LeveranciersBeheer from "@/components/LeveranciersBeheer";
import {
  createBestelling,
  updateBestellingRegel,
  updateBestellingLeverancier,
  markeerVerstuurd,
  annuleerBestelling,
  bevestigLevering,
} from "@/app/(app)/bestellingen/actions";

const STATUS_LABEL: Record<BestellingStatus, string> = {
  concept: "Concept",
  verstuurd: "Verstuurd",
  deels_geleverd: "Deels geleverd",
  geleverd: "Geleverd",
  geannuleerd: "Geannuleerd",
};
const STATUS_TONE: Record<BestellingStatus, string> = {
  concept: "bg-[#F1F1F6] text-[#6B7094]",
  verstuurd: "bg-[#E7F0FD] text-[#2F6FCB]",
  deels_geleverd: "bg-[#FDF1DE] text-[#B4790C]",
  geleverd: "bg-[#E4F6EE] text-[#1B8E63]",
  geannuleerd: "bg-[#FDECEC] text-[#B03A30]",
};

export default function BestellingenView({
  buildings,
  products,
  productBuildings,
  leveranciers,
  bestellingen,
  bestellingRegels,
  canEdit,
  defaultNaam,
}: {
  buildings: Building[];
  products: Product[];
  productBuildings: { product_id: string; building_id: string; volgorde: number }[];
  leveranciers: Leverancier[];
  bestellingen: Bestelling[];
  bestellingRegels: BestellingRegel[];
  canEdit: boolean;
  defaultNaam: string;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toonLeveranciers, setToonLeveranciers] = useState(false);
  const actieveLeveranciers = leveranciers.filter((l) => l.actief);

  function refresh() {
    router.refresh();
  }

  if (creating) {
    return (
      <NieuweBestelling
        buildings={buildings}
        products={products}
        productBuildings={productBuildings}
        leveranciers={actieveLeveranciers}
        defaultNaam={defaultNaam}
        onCancel={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setOpenId(id);
          refresh();
        }}
      />
    );
  }

  const open = bestellingen.find((b) => b.id === openId);
  if (open) {
    return (
      <BestellingDetail
        bestelling={open}
        regels={bestellingRegels.filter((r) => r.bestelling_id === open.id)}
        products={products}
        buildings={buildings}
        leveranciers={actieveLeveranciers}
        canEdit={canEdit}
        defaultNaam={defaultNaam}
        onBack={() => setOpenId(null)}
        onChanged={refresh}
      />
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-[#171A2B]">Bestellingen</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setToonLeveranciers((v) => !v)}
            className="px-4 py-2 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#171A2B] flex items-center gap-2"
          >
            <Users size={15} /> Leveranciers
          </button>
          {canEdit && (
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-2"
            >
              <Plus size={15} /> Nieuwe bestelling
            </button>
          )}
        </div>
      </div>
      <p className="text-[#8A8FA8] text-sm mb-6">Van concept tot bevestigde levering, per gebouw.</p>

      {toonLeveranciers && <LeveranciersBeheer leveranciers={leveranciers} canEdit={canEdit} />}

      {bestellingen.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#ECECF3] px-5 py-6 text-sm text-[#B0B4CC]">
          Nog geen bestellingen. Maak er hierboven een aan, of ga naar Voorraad voor een automatisch voorstel.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
          <div className="divide-y divide-[#ECECF3]">
            {bestellingen.map((b) => {
              const gebouw = buildings.find((x) => x.id === b.building_id)?.name || "?";
              const leverancier = leveranciers.find((l) => l.id === b.leverancier_id)?.naam;
              const aantalRegels = bestellingRegels.filter((r) => r.bestelling_id === b.id).length;
              return (
                <button
                  key={b.id}
                  onClick={() => setOpenId(b.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-[#F7F7FB]"
                >
                  <div>
                    <div className="text-sm font-semibold text-[#171A2B]">
                      {gebouw}
                      {leverancier && <span className="text-[#8A8FA8] font-normal"> &middot; {leverancier}</span>}
                    </div>
                    <div className="text-xs text-[#8A8FA8]">
                      {formatDate(b.created_at)} &middot; {aantalRegels} product(en)
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 ${STATUS_TONE[b.status]}`}>
                      {STATUS_LABEL[b.status]}
                    </span>
                    <ChevronRight size={15} className="text-[#C7CAE0]" />
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

function NieuweBestelling({
  buildings,
  products,
  productBuildings,
  leveranciers,
  defaultNaam,
  onCancel,
  onCreated,
}: {
  buildings: Building[];
  products: Product[];
  productBuildings: { product_id: string; building_id: string; volgorde: number }[];
  leveranciers: Leverancier[];
  defaultNaam: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [buildingId, setBuildingId] = useState(buildings[0]?.id || "");
  const [leverancierId, setLeverancierId] = useState<string>("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [pending, startTransition] = useTransition();

  const gebouwProducten = useMemo(() => {
    const links = productBuildings
      .filter((l) => l.building_id === buildingId)
      .sort((a, b) => a.volgorde - b.volgorde || a.product_id.localeCompare(b.product_id));
    return links.map((l) => products.find((p) => p.id === l.product_id)).filter((p): p is Product => !!p);
  }, [productBuildings, products, buildingId]);

  function setAmount(id: string, val: number) {
    setAmounts((a) => ({ ...a, [id]: Math.max(0, val) }));
  }

  function submit() {
    const regels = Object.entries(amounts)
      .filter(([, aantal]) => aantal > 0)
      .map(([productId, aantal]) => ({ productId, aantal }));
    if (regels.length === 0) return;

    startTransition(async () => {
      const id = await createBestelling(buildingId, leverancierId || null, regels, defaultNaam);
      if (id) onCreated(id);
    });
  }

  return (
    <div>
      <button onClick={onCancel} className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1 mb-4">
        <ChevronRight size={14} className="rotate-180" /> Terug naar bestellingen
      </button>
      <h1 className="text-2xl font-bold text-[#171A2B] mb-4">Nieuwe bestelling</h1>

      <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Gebouw</label>
            <select
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
              className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            >
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Leverancier</label>
            <select
              value={leverancierId}
              onChange={(e) => setLeverancierId(e.target.value)}
              className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            >
              <option value="">Nog te kiezen&hellip;</option>
              {leveranciers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.naam}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-[#B0B4CC] mt-1">Ontbreekt je leverancier? Voeg die eerst toe via "Leveranciers" op het overzicht.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-4">
        {gebouwProducten.length === 0 && (
          <div className="px-5 py-6 text-sm text-[#B0B4CC]">Dit gebouw heeft nog geen gekoppelde producten.</div>
        )}
        <div className="divide-y divide-[#ECECF3]">
          {gebouwProducten.map((p) => {
            const val = amounts[p.id] ?? 0;
            return (
              <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                <span className="text-sm text-[#171A2B]">{p.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAmount(p.id, val - 1)} className="w-7 h-7 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]">
                    <Minus size={13} />
                  </button>
                  <span className="text-sm font-semibold text-[#171A2B] w-6 text-center">{val}</span>
                  <button onClick={() => setAmount(p.id, val + 1)} className="w-7 h-7 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]">
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={submit}
        disabled={pending}
        className="px-5 py-2.5 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Bezig\u2026" : "Bestelling aanmaken"}
      </button>
    </div>
  );
}

function BestellingDetail({
  bestelling,
  regels,
  products,
  buildings,
  leveranciers,
  canEdit,
  defaultNaam,
  onBack,
  onChanged,
}: {
  bestelling: Bestelling;
  regels: BestellingRegel[];
  products: Product[];
  buildings: Building[];
  leveranciers: Leverancier[];
  canEdit: boolean;
  defaultNaam: string;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [ontvangst, setOntvangst] = useState<Record<string, number>>({});
  const [wie, setWie] = useState(defaultNaam);
  const [bevestigOpen, setBevestigOpen] = useState(false);

  const gebouw = buildings.find((b) => b.id === bestelling.building_id);
  const isConcept = bestelling.status === "concept";
  const kanLeveringBevestigen = ["verstuurd", "deels_geleverd"].includes(bestelling.status);

  function productNaam(id: string) {
    return products.find((p) => p.id === id)?.name || "?";
  }

  function tekstVoorEmail() {
    const lines = [
      `Bestelling ${gebouw?.name || ""}`,
      `Datum: ${formatDate(bestelling.created_at)}`,
      "",
      ...regels.map((r) => `${r.besteld_aantal} x ${productNaam(r.product_id)}`),
    ];
    return lines.join("\n");
  }

  function kopieer() {
    navigator.clipboard.writeText(tekstVoorEmail()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function openBevestigen() {
    const init: Record<string, number> = {};
    for (const r of regels) init[r.product_id] = Math.max(0, r.besteld_aantal - r.geleverd_aantal);
    setOntvangst(init);
    setBevestigOpen(true);
  }

  function submitLevering() {
    const lijst = Object.entries(ontvangst)
      .filter(([, aantal]) => aantal > 0)
      .map(([productId, aantal]) => ({ productId, aantal }));
    if (lijst.length === 0) return;
    startTransition(async () => {
      await bevestigLevering(bestelling.id, bestelling.building_id, lijst, wie);
      setBevestigOpen(false);
      onChanged();
    });
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-[#6D5AE6] font-semibold flex items-center gap-1 mb-4">
        <ChevronRight size={14} className="rotate-180" /> Terug naar bestellingen
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#171A2B]">{gebouw?.name}</h1>
          <p className="text-[#8A8FA8] text-sm">{formatDate(bestelling.created_at)}</p>
        </div>
        <span className={`text-xs font-semibold uppercase tracking-wide rounded-full px-3 py-1 ${STATUS_TONE[bestelling.status]}`}>
          {STATUS_LABEL[bestelling.status]}
        </span>
      </div>

      <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-4">
        <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Leverancier</label>
        <select
          disabled={!canEdit}
          defaultValue={bestelling.leverancier_id || ""}
          onChange={(e) =>
            startTransition(() => updateBestellingLeverancier(bestelling.id, e.target.value || null).then(onChanged))
          }
          className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm disabled:bg-[#F7F7FB]"
        >
          <option value="">Nog te kiezen&hellip;</option>
          {leveranciers.map((l) => (
            <option key={l.id} value={l.id}>
              {l.naam}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-2.5 font-semibold">Product</th>
              <th className="text-right px-3 py-2.5 font-semibold">Besteld</th>
              <th className="text-right px-5 py-2.5 font-semibold">Ontvangen</th>
            </tr>
          </thead>
          <tbody>
            {regels.map((r) => (
              <tr key={r.product_id} className="border-t border-[#ECECF3]">
                <td className="px-5 py-2.5 font-medium text-[#171A2B]">{productNaam(r.product_id)}</td>
                <td className="px-3 py-2.5 text-right">
                  {isConcept && canEdit ? (
                    <input
                      type="number"
                      defaultValue={r.besteld_aantal}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 0;
                        if (v !== r.besteld_aantal) startTransition(() => updateBestellingRegel(bestelling.id, r.product_id, v).then(onChanged));
                      }}
                      className="w-20 text-right rounded-lg border border-[#ECECF3] px-2 py-1"
                    />
                  ) : (
                    <span className="text-[#171A2B]">{r.besteld_aantal}</span>
                  )}
                </td>
                <td className="px-5 py-2.5 text-right text-[#5B5F82]">
                  {r.geleverd_aantal}
                  {r.geleverd_aantal < r.besteld_aantal && r.geleverd_aantal > 0 && (
                    <span className="text-[#B4790C]"> (nog {r.besteld_aantal - r.geleverd_aantal})</span>
                  )}
                </td>
              </tr>
            ))}
            {regels.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-6 text-sm text-[#B0B4CC]">
                  Geen producten in deze bestelling.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={kopieer} className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#171A2B] hover:bg-[#F7F7FB]">
          {copied ? <Check size={14} className="text-[#1FAE7A]" /> : <Copy size={14} />}
          {copied ? "Gekopieerd" : "Kopieer voor e-mail"}
        </button>
        {canEdit && isConcept && (
          <button
            onClick={() => startTransition(() => markeerVerstuurd(bestelling.id).then(onChanged))}
            disabled={pending || regels.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
          >
            <Package size={14} /> Markeer als verstuurd
          </button>
        )}
        {canEdit && kanLeveringBevestigen && (
          <button
            onClick={openBevestigen}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1FAE7A] text-white text-sm font-semibold"
          >
            <Truck size={14} /> Levering bevestigen
          </button>
        )}
        {canEdit && (isConcept || bestelling.status === "verstuurd") && (
          <button
            onClick={() => {
              if (confirm("Deze bestelling annuleren?")) startTransition(() => annuleerBestelling(bestelling.id).then(onChanged));
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#B03A30]"
          >
            <X size={14} /> Annuleer
          </button>
        )}
      </div>

      {bevestigOpen && (
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
          <div className="font-bold text-[#171A2B] mb-1">Levering bevestigen</div>
          <p className="text-xs text-[#8A8FA8] mb-4">
            Vul in wat er nu effectief aankwam &mdash; niet alles hoeft in \u00e9\u00e9n keer te komen, je kan dit later
            opnieuw doen voor wat nog ontbreekt.
          </p>
          <div className="divide-y divide-[#ECECF3] mb-4">
            {regels.map((r) => (
              <div key={r.product_id} className="flex items-center justify-between py-2">
                <div>
                  <span className="text-sm text-[#171A2B]">{productNaam(r.product_id)}</span>
                  <span className="text-xs text-[#8A8FA8] ml-2">
                    (besteld {r.besteld_aantal}, al ontvangen {r.geleverd_aantal})
                  </span>
                </div>
                <input
                  type="number"
                  value={ontvangst[r.product_id] ?? 0}
                  onChange={(e) => setOntvangst((o) => ({ ...o, [r.product_id]: Math.max(0, Number(e.target.value) || 0) }))}
                  className="w-20 text-right rounded-lg border border-[#ECECF3] px-2 py-1 text-sm"
                />
              </div>
            ))}
          </div>
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Ontvangen door</label>
          <input
            value={wie}
            onChange={(e) => setWie(e.target.value)}
            className="w-full mt-1.5 mb-4 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={submitLevering}
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-[#1FAE7A] text-white text-sm font-semibold disabled:opacity-50"
            >
              {pending ? "Bezig\u2026" : "Bevestigen"}
            </button>
            <button onClick={() => setBevestigOpen(false)} className="px-4 py-2 rounded-lg border border-[#ECECF3] text-sm font-semibold text-[#8A8FA8]">
              Annuleer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
