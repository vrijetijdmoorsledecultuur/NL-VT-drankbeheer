"use client";

import { useTransition } from "react";
import { Check, ReceiptText } from "lucide-react";
import type { Building, Factuur, FactuurRegel, Product } from "@/lib/types";
import { approveFactuur, markFactuurRecreatex } from "@/app/(app)/controle/actions";
import { formatDate } from "@/lib/format";

export default function FacturenGoedkeuring({ facturen, factuurRegels, buildings, products }: { facturen: Factuur[]; factuurRegels: FactuurRegel[]; buildings: Building[]; products: Product[] }) {
  const [pending, startTransition] = useTransition();
  const open = facturen.filter((factuur) => factuur.status !== "goedgekeurd" || !factuur.recreatex_verwerkt);
  if (open.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-6">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-[#ECECF3]">
        <div className="w-9 h-9 rounded-lg bg-[#E7F0FD] text-[#2F6FCB] flex items-center justify-center"><ReceiptText size={17} /></div>
        <div><div className="font-bold text-[#171A2B]">Facturen ter goedkeuring</div><div className="text-xs text-[#8A8FA8]">Controleer en markeer daarna de verwerking in Recreatex.</div></div>
      </div>
      <div className="divide-y divide-[#ECECF3]">
        {open.map((factuur) => {
          const regels = factuurRegels.filter((regel) => regel.factuur_id === factuur.id);
          return (
            <article key={factuur.id} className="px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="flex-1">
                <div className="font-semibold text-[#171A2B]">{factuur.naam}</div>
                <div className="text-xs text-[#8A8FA8]">{buildings.find((gebouw) => gebouw.id === factuur.building_id)?.name || "Onbekend gebouw"} · {formatDate(factuur.datum)} · {regels.length} regel(s)</div>
                {regels.length > 0 && <div className="mt-2 text-xs text-[#5B5F82]">{regels.slice(0, 4).map((regel) => `${products.find((product) => product.id === regel.product_id)?.name || "Product"}: ${regel.aantal}`).join(" · ")}</div>}
              </div>
              <div className="text-lg font-bold text-[#171A2B]">€ {Number(factuur.bedrag || 0).toFixed(2).replace(".", ",")}</div>
              <div className="flex gap-2">
                {factuur.status !== "goedgekeurd" ? (
                  <button disabled={pending} onClick={() => startTransition(() => approveFactuur(factuur.id))} className="px-3 py-2 rounded-lg bg-[#6D5AE6] text-white text-xs font-semibold flex items-center gap-1.5"><Check size={13} />Goedkeuren</button>
                ) : !factuur.recreatex_verwerkt ? (
                  <button disabled={pending} onClick={() => startTransition(() => markFactuurRecreatex(factuur.id))} className="px-3 py-2 rounded-lg border border-[#ECECF3] text-xs font-semibold text-[#171A2B]">Verwerkt in Recreatex</button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
