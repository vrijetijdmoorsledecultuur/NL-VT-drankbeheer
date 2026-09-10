"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, ChevronDown, ChevronUp, Download } from "lucide-react";
import type { Building, Product, Factuur, FactuurRegel } from "@/lib/types";
import { goedkeurFactuur } from "@/app/(app)/verwerking/actions";
import { genereerFactuurPdf } from "@/lib/genereerFactuurPdf";
import { formatDate } from "@/lib/format";

export default function FacturenGoedkeuring({
  facturen,
  factuurRegels,
  buildings,
  products,
}: {
  facturen: Factuur[];
  factuurRegels: FactuurRegel[];
  buildings: Building[];
  products: Product[];
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openFacturen = facturen.filter((f) => f.status === "open");
  if (openFacturen.length === 0) return null;

  function goedkeuren(f: Factuur) {
    startTransition(async () => {
      await goedkeurFactuur(f.id);
      const gebouwNaam = buildings.find((b) => b.id === f.building_id)?.name || "?";
      const regels = factuurRegels.filter((r) => r.factuur_id === f.id);
      genereerFactuurPdf({ ...f, status: "goedgekeurd", goedgekeurd_door: null }, regels, products, gebouwNaam);
      router.refresh();
      setOpenId(null);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-6">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#FBEAF0] text-[#B4497F] flex items-center justify-center shrink-0">
          <FileText size={15} />
        </div>
        <div>
          <div className="font-bold text-[#171A2B]">Facturen & creditnota&apos;s ter goedkeuring</div>
          <div className="text-xs text-[#8A8FA8]">Via Snelle Verwerking geregistreerd, wacht op goedkeuring.</div>
        </div>
      </div>
      <div className="divide-y divide-[#ECECF3]">
        {openFacturen.map((f) => {
          const gebouw = buildings.find((b) => b.id === f.building_id);
          const regels = factuurRegels.filter((r) => r.factuur_id === f.id);
          const open = openId === f.id;
          return (
            <div key={f.id}>
              <button onClick={() => setOpenId(open ? null : f.id)} className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-[#F7F7FB]">
                <div>
                  <div className="text-sm font-semibold text-[#171A2B]">
                    {f.naam} &middot; {f.type === "creditnota" ? "\u2212" : ""}&euro;{f.bedrag.toFixed(2)}
                  </div>
                  <div className="text-xs text-[#8A8FA8]">
                    {gebouw?.name} &middot; {formatDate(f.datum)} &middot; {f.type === "factuur" ? "Factuur" : "Creditnota"}
                  </div>
                </div>
                {open ? <ChevronUp size={15} className="text-[#8A8FA8]" /> : <ChevronDown size={15} className="text-[#8A8FA8]" />}
              </button>
              {open && (
                <div className="px-5 pb-4 bg-[#F7F7FB]">
                  <div className="divide-y divide-[#ECECF3] bg-white rounded-lg border border-[#ECECF3] mb-3">
                    {regels.map((r) => {
                      const product = products.find((p) => p.id === r.product_id);
                      return (
                        <div key={r.product_id} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-[#171A2B]">{product?.name || "?"}</span>
                          <span className="text-[#5B5F82]">
                            {r.aantal} &times; &euro;{r.prijs.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => goedkeuren(f)}
                    disabled={pending}
                    className="w-full py-2.5 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Goedkeuren
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
