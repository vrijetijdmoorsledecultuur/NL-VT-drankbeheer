"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Truck, Plus, Check } from "lucide-react";
import type { Leverancier } from "@/lib/types";
import { addLeverancier, updateLeverancier, toggleLeverancierActief } from "@/app/(app)/bestellingen/actions";

export default function LeveranciersBeheer({ leveranciers, canEdit }: { leveranciers: Leverancier[]; canEdit: boolean }) {
  const router = useRouter();
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [telefoon, setTelefoon] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function toevoegen() {
    setError(null);
    if (!naam.trim()) {
      setError("Vul een naam in.");
      return;
    }
    startTransition(async () => {
      const id = await addLeverancier(naam, email, telefoon);
      if (!id) {
        setError("Opslaan is niet gelukt. Probeer opnieuw.");
        return;
      }
      setNaam("");
      setEmail("");
      setTelefoon("");
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-6">
      <div className="px-5 pt-4 pb-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#E7F0FD] text-[#2F6FCB] flex items-center justify-center shrink-0">
          <Truck size={15} />
        </div>
        <div>
          <div className="font-bold text-[#171A2B]">Leveranciers</div>
          <div className="text-xs text-[#8A8FA8]">Beheer hier je drankleveranciers, los van een specifieke bestelling.</div>
        </div>
      </div>

      <div className="divide-y divide-[#ECECF3]">
        {leveranciers.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-5 py-2.5">
            <input
              disabled={!canEdit}
              defaultValue={l.naam}
              onBlur={(e) => {
                if (e.target.value.trim() && e.target.value !== l.naam) {
                  startTransition(() => updateLeverancier(l.id, { naam: e.target.value }).then(() => router.refresh()));
                }
              }}
              className="flex-1 min-w-0 text-sm font-medium text-[#171A2B] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1 -mx-2"
            />
            <input
              disabled={!canEdit}
              defaultValue={l.email || ""}
              placeholder="e-mail"
              onBlur={(e) => {
                if (e.target.value !== (l.email || "")) {
                  startTransition(() => updateLeverancier(l.id, { email: e.target.value }).then(() => router.refresh()));
                }
              }}
              className="w-48 text-sm text-[#5B5F82] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1"
            />
            <input
              disabled={!canEdit}
              defaultValue={l.telefoon || ""}
              placeholder="telefoon"
              onBlur={(e) => {
                if (e.target.value !== (l.telefoon || "")) {
                  startTransition(() => updateLeverancier(l.id, { telefoon: e.target.value }).then(() => router.refresh()));
                }
              }}
              className="w-36 text-sm text-[#5B5F82] border border-transparent hover:border-[#ECECF3] focus:border-[#ECECF3] rounded-lg px-2 py-1"
            />
            {canEdit && (
              <button
                onClick={() => startTransition(() => toggleLeverancierActief(l.id, !l.actief).then(() => router.refresh()))}
                className={`text-[10px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5 shrink-0 ${
                  l.actief ? "bg-[#E4F6EE] text-[#1B8E63]" : "bg-[#F1F1F6] text-[#6B7094]"
                }`}
              >
                {l.actief ? "Actief" : "Inactief"}
              </button>
            )}
          </div>
        ))}
        {leveranciers.length === 0 && <div className="px-5 py-4 text-sm text-[#B0B4CC]">Nog geen leveranciers.</div>}
      </div>

      {canEdit && (
        <div className="px-5 py-4 border-t border-[#ECECF3] flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Naam</label>
            <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Bv. Colruyt Group Drinks" className="block mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm w-56" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">E-mail (optioneel)</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="block mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm w-48" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Telefoon (optioneel)</label>
            <input value={telefoon} onChange={(e) => setTelefoon(e.target.value)} className="block mt-1 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm w-36" />
          </div>
          <button
            onClick={toevoegen}
            disabled={pending}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
          >
            {saved ? <Check size={14} /> : <Plus size={14} />}
            {pending ? "Bezig\u2026" : saved ? "Toegevoegd" : "Toevoegen"}
          </button>
        </div>
      )}
      {error && <div className="px-5 pb-4 text-xs text-[#D6493C]">{error}</div>}
    </div>
  );
}
