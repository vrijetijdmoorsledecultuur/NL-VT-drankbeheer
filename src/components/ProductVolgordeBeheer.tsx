"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, ListOrdered } from "lucide-react";
import type { Product, Building, Telplek, TelplekProduct } from "@/lib/types";
import { moveTelplekProductOrder } from "@/app/(app)/producten/actions";

export default function ProductVolgordeBeheer({
  products,
  buildings,
  telplekken,
  telplekProducten,
  canEdit,
}: {
  products: Product[];
  buildings: Building[];
  telplekken: Telplek[];
  telplekProducten: TelplekProduct[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [buildingId, setBuildingId] = useState(buildings[0]?.id || "");
  const telplekkenVoorGebouw = useMemo(() => telplekken.filter((t) => t.building_id === buildingId), [telplekken, buildingId]);
  const [telplekId, setTelplekId] = useState(telplekkenVoorGebouw[0]?.id || "");
  const [pending, startTransition] = useTransition();

  function kiesGebouw(id: string) {
    setBuildingId(id);
    const eerste = telplekken.find((t) => t.building_id === id);
    setTelplekId(eerste?.id || "");
  }

  const ordered = useMemo(() => {
    const links = telplekProducten
      .filter((l) => l.telplek_id === telplekId)
      .sort((a, b) => a.volgorde - b.volgorde || a.product_id.localeCompare(b.product_id));
    return links
      .map((l) => products.find((p) => p.id === l.product_id))
      .filter((p): p is Product => !!p && p.actief);
  }, [telplekProducten, products, telplekId]);

  function move(productId: string, direction: "up" | "down") {
    startTransition(async () => {
      await moveTelplekProductOrder(telplekId, productId, direction);
      router.refresh();
    });
  }

  if (!canEdit) return null;

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mt-6">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#E1F5F1] text-[#1B9C82] flex items-center justify-center shrink-0">
          <ListOrdered size={15} />
        </div>
        <div>
          <div className="font-bold text-[#171A2B]">Telvolgorde per telplek</div>
          <div className="text-xs text-[#8A8FA8]">
            Bepaal de volgorde waarin producten getoond worden bij het tellen &mdash; per telplek apart, zodat Frigo
            en Koelcel elk hun eigen fysieke indeling kunnen volgen.
          </div>
        </div>
      </div>

      <div className="px-5 pb-3 flex flex-wrap gap-2">
        <select
          value={buildingId}
          onChange={(e) => kiesGebouw(e.target.value)}
          className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
        >
          {buildings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={telplekId}
          onChange={(e) => setTelplekId(e.target.value)}
          className="rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
        >
          {telplekkenVoorGebouw.length === 0 && <option value="">Geen telplekken</option>}
          {telplekkenVoorGebouw.map((t) => (
            <option key={t.id} value={t.id}>
              {t.naam}
            </option>
          ))}
        </select>
      </div>

      <div className="divide-y divide-[#ECECF3]">
        {telplekkenVoorGebouw.length === 0 && (
          <div className="px-5 py-6 text-sm text-[#B0B4CC]">
            Dit gebouw heeft nog geen telplekken. Maak die eerst aan bij Gebouwen &gt; Telplekken.
          </div>
        )}
        {telplekkenVoorGebouw.length > 0 && ordered.length === 0 && (
          <div className="px-5 py-6 text-sm text-[#B0B4CC]">Deze telplek heeft nog geen gekoppelde producten.</div>
        )}
        {ordered.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
            <span className="text-sm text-[#171A2B]">{p.name}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={pending || i === 0}
                onClick={() => move(p.id, "up")}
                className="w-7 h-7 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6] disabled:opacity-30"
              >
                <ArrowUp size={13} />
              </button>
              <button
                disabled={pending || i === ordered.length - 1}
                onClick={() => move(p.id, "down")}
                className="w-7 h-7 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6] disabled:opacity-30"
              >
                <ArrowDown size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
