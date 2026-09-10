"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { History, Plus, Trash2 } from "lucide-react";
import type { Product, ProductPrijs } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { plantPrijswijziging, verwijderPrijsRegel } from "@/app/(app)/producten/actions";

export default function PrijsGeschiedenisBeheer({
  products,
  prijzen,
  canEdit,
}: {
  products: Product[];
  prijzen: ProductPrijs[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [nieuwePrijs, setNieuwePrijs] = useState("");
  const [geldigVanaf, setGeldigVanaf] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const geschiedenis = useMemo(
    () =>
      prijzen
        .filter((p) => p.product_id === productId)
        .sort((a, b) => b.geldig_vanaf.localeCompare(a.geldig_vanaf)),
    [prijzen, productId]
  );

  const vandaag = new Date().toISOString().slice(0, 10);

  function toevoegen() {
    setError(null);
    const bedrag = Number(nieuwePrijs.replace(",", "."));
    if (!productId || isNaN(bedrag) || bedrag <= 0) {
      setError("Vul een geldig bedrag in.");
      return;
    }
    if (!geldigVanaf) {
      setError("Vul een ingangsdatum in.");
      return;
    }
    startTransition(async () => {
      await plantPrijswijziging(productId, bedrag, geldigVanaf);
      setNieuwePrijs("");
      router.refresh();
    });
  }

  function verwijderen(id: string) {
    if (!confirm("Deze prijsregel verwijderen?")) return;
    startTransition(async () => {
      await verwijderPrijsRegel(id);
      router.refresh();
    });
  }

  if (!canEdit) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mt-6">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#FBEAF0] text-[#B4497F] flex items-center justify-center shrink-0">
          <History size={15} />
        </div>
        <div>
          <div className="font-bold text-[#171A2B]">Prijsgeschiedenis</div>
          <div className="text-xs text-[#8A8FA8]">
            Plan een prijswijziging in, ook voor een toekomstige datum (bv. 1 september). Oudere reservaties en
            facturen blijven de prijs tonen die op dát moment gold.
          </div>
        </div>
      </div>

      <div className="px-5 pb-3">
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-[#ECECF3]">
        {geschiedenis.length === 0 && <div className="px-5 py-4 text-sm text-[#B0B4CC]">Nog geen prijsgeschiedenis.</div>}
        {geschiedenis.map((regel) => {
          const toekomstig = regel.geldig_vanaf > vandaag;
          return (
            <div key={regel.id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <span className="text-sm font-semibold text-[#171A2B]">&euro;{regel.prijs.toFixed(2)}</span>
                <span className="text-xs text-[#8A8FA8] ml-2">
                  vanaf {formatDate(regel.geldig_vanaf)}
                  {toekomstig && <span className="text-[#B4790C]"> &middot; nog niet actief</span>}
                </span>
              </div>
              <button onClick={() => verwijderen(regel.id)} className="text-[#C7CAE0] hover:text-[#D6493C]">
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-4 border-t border-[#ECECF3] flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Nieuwe prijs</label>
          <input
            value={nieuwePrijs}
            onChange={(e) => setNieuwePrijs(e.target.value)}
            placeholder="0,00"
            className="block mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm w-28"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Geldig vanaf</label>
          <input
            type="date"
            value={geldigVanaf}
            onChange={(e) => setGeldigVanaf(e.target.value)}
            className="block mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
        </div>
        <button
          onClick={toevoegen}
          disabled={pending}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
        >
          <Plus size={14} /> Inplannen
        </button>
      </div>
      {error && <div className="px-5 pb-4 text-xs text-[#D6493C]">{error}</div>}
    </div>
  );
}
