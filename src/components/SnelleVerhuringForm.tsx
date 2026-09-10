"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Building } from "@/lib/types";
import { saveReservations } from "@/app/(app)/reservaties/actions";

export default function SnelleVerhuringForm({
  buildings,
  initieelOpen = false,
  standalone = false,
}: {
  buildings: Building[];
  initieelOpen?: boolean;
  standalone?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initieelOpen);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [buildingId, setBuildingId] = useState(buildings[0]?.id || "");
  const [huurder, setHuurder] = useState("");
  const [activiteit, setActiviteit] = useState("");
  const [ruimte, setRuimte] = useState("");
  const [datum, setDatum] = useState(() => new Date().toISOString().slice(0, 10));
  const [beginUur, setBeginUur] = useState("09:00");
  const [eindUur, setEindUur] = useState("17:00");

  function reset() {
    setHuurder("");
    setActiviteit("");
    setRuimte("");
    setBeginUur("09:00");
    setEindUur("17:00");
  }

  function submit() {
    setError(null);
    if (!huurder.trim()) {
      setError("Vul een naam in (huurder of vereniging).");
      return;
    }
    startTransition(async () => {
      const res = await saveReservations([
        {
          buildingId,
          huurder: huurder.trim(),
          adres: "",
          telefoon: "",
          activiteit: activiteit.trim(),
          ruimte: ruimte.trim(),
          beginDatum: datum,
          eindDatum: datum,
          toegangStart: beginUur || null,
          activiteitStart: beginUur || null,
          activiteitEind: eindUur || null,
          toegangEind: eindUur || null,
          bron: "manueel",
        },
      ]);
      if (!res.ok) {
        setError(res.error || "Opslaan mislukt.");
        return;
      }
      if (res.id) {
        router.push(`/controle?reservationId=${res.id}`);
        return;
      }
      reset();
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    });
  }

  const formContent = (
    <>
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
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Huurder / vereniging</label>
          <input
            value={huurder}
            onChange={(e) => setHuurder(e.target.value)}
            placeholder="Bv. I-mens"
            className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Activiteit (optioneel)</label>
          <input
            value={activiteit}
            onChange={(e) => setActiviteit(e.target.value)}
            placeholder="Bv. vergadering"
            className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Ruimte (optioneel)</label>
          <input
            value={ruimte}
            onChange={(e) => setRuimte(e.target.value)}
            placeholder="Bv. Foyer"
            className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Datum</label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Beginuur</label>
            <input
              type="time"
              value={beginUur}
              onChange={(e) => setBeginUur(e.target.value)}
              className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#8A8FA8] uppercase tracking-wide">Einduur</label>
            <input
              type="time"
              value={eindUur}
              onChange={(e) => setEindUur(e.target.value)}
              className="w-full mt-1.5 rounded-lg border border-[#ECECF3] px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {error && <div className="text-xs text-[#D6493C] mt-3">{error}</div>}
      {saved && <div className="text-xs text-[#1FAE7A] mt-3">Reservatie aangemaakt.</div>}

      <button
        onClick={submit}
        disabled={pending}
        className="mt-4 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Bezig\u2026" : "Reservatie aanmaken \u2192 direct naar tellingen"}
      </button>
    </>
  );

  if (standalone) {
    return <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">{formContent}</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] overflow-hidden mb-6">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-[#171A2B]">Snelle verhuring boeken</div>
          <div className="text-xs text-[#8A8FA8]">Een reservatie manueel toevoegen, zonder Recreatex-PDF.</div>
        </div>
        {open ? <ChevronUp size={16} className="text-[#8A8FA8]" /> : <ChevronDown size={16} className="text-[#8A8FA8]" />}
      </button>

      {open && <div className="px-5 pb-5 border-t border-[#ECECF3] pt-4">{formContent}</div>}
    </div>
  );
}
