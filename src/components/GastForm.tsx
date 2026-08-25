"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { submitGastTelling, type GastContext, type GastProduct } from "@/app/gast/[code]/actions";

export default function GastForm({
  code,
  context,
  producten,
}: {
  code: string;
  context: GastContext;
  producten: GastProduct[];
}) {
  const [naam, setNaam] = useState("");
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, GastProduct[]>();
    for (const p of producten) {
      if (!map.has(p.categorie)) map.set(p.categorie, []);
      map.get(p.categorie)!.push(p);
    }
    return Array.from(map.entries());
  }, [producten]);

  function setAmount(id: string, val: number) {
    setAmounts((a) => ({ ...a, [id]: Math.max(0, val) }));
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const regels = Object.entries(amounts)
      .filter(([, aantal]) => aantal > 0)
      .map(([productId, aantal]) => ({ productId, aantal }));

    if (regels.length === 0) {
      setSubmitting(false);
      setError("Vul minstens één aantal in.");
      return;
    }

    const res = await submitGastTelling(code, naam, regels);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error || "Er ging iets mis, probeer opnieuw.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#F7F7FB] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-8 max-w-sm text-center">
          <div className="w-12 h-12 rounded-full bg-[#E4F6EE] text-[#1FAE7A] flex items-center justify-center mx-auto mb-4">
            <Check size={22} />
          </div>
          <div className="font-bold text-[#171A2B] mb-2">Bedankt!</div>
          <p className="text-sm text-[#8A8FA8]">
            Je registratie is verstuurd. Een beheerder controleert dit; het telt pas mee zodra het is goedgekeurd.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7FB] pb-28">
      <div className="bg-[#12172B] text-white px-5 py-5">
        <div className="text-[11px] font-semibold tracking-wide text-[#B9BEDA] uppercase">Drankverbruik registreren</div>
        <div className="text-lg font-bold">{context.gebouw_naam}</div>
        <div className="text-sm text-[#B9BEDA]">
          {context.huurder}
          {context.activiteit ? ` · ${context.activiteit}` : ""}
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        <div className="bg-white rounded-2xl border border-[#ECECF3] p-4">
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Jouw naam (optioneel)</label>
          <input
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            placeholder="Bv. Jan Janssens"
            className="w-full mt-2 rounded-lg border border-[#ECECF3] px-3 py-2.5 text-sm"
          />
        </div>

        {grouped.map(([categorie, items]) => (
          <div key={categorie} className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden">
            <div className="px-4 py-2.5 text-xs font-bold text-[#8A8FA8] uppercase tracking-wide bg-[#F7F7FB]">
              {categorie}
            </div>
            <div className="divide-y divide-[#ECECF3]">
              {items.map((p) => {
                const value = amounts[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
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
                        className="w-12 text-center text-sm font-semibold border border-[#ECECF3] rounded-lg py-1.5"
                      />
                      <button
                        onClick={() => setAmount(p.id, value + 1)}
                        className="w-8 h-8 rounded-lg border border-[#ECECF3] flex items-center justify-center text-[#6D5AE6]"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {producten.length === 0 && (
          <div className="text-sm text-[#8A8FA8] text-center py-6">Geen producten gevonden voor dit gebouw.</div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#ECECF3] p-4">
        <div className="max-w-lg mx-auto">
          {error && <div className="text-sm text-[#D6493C] mb-2">{error}</div>}
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-[#6D5AE6] text-white font-semibold disabled:opacity-50"
          >
            {submitting ? "Bezig met versturen\u2026" : "Registratie versturen"}
          </button>
        </div>
      </div>
    </div>
  );
}
