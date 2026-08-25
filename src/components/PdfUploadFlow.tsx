"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import type { Building } from "@/lib/types";
import { extractPdf, saveReservations, type ReservationInput } from "@/app/(app)/reservaties/actions";

type DraftRow = ReservationInput & { key: string };

export default function PdfUploadFlow({ buildings }: { buildings: Building[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
  const [saved, setSaved] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("file", file);
    startTransition(async () => {
      const result = await extractPdf(fd);
      if (!result.ok) {
        setError(result.error || "Onbekende fout bij het uitlezen.");
        setDrafts(null);
        return;
      }
      setWarnings(result.warnings || []);
      const defaultBuildingId = result.matchedBuildingId || buildings[0]?.id || "";
      const rows: DraftRow[] = (result.reservations || []).map((r, i) => ({
        key: `${i}-${r.beginDatum}-${r.huurder}`,
        buildingId: defaultBuildingId,
        huurder: r.huurder,
        adres: r.adres,
        telefoon: r.telefoon,
        activiteit: r.activiteit,
        ruimte: r.ruimte,
        beginDatum: r.beginDatum,
        eindDatum: r.eindDatum,
        toegangStart: r.toegangStart,
        activiteitStart: r.activiteitStart,
        activiteitEind: r.activiteitEind,
        toegangEind: r.toegangEind,
        bron: "pdf",
      }));
      setDrafts(rows);
      if (!result.matchedBuildingId) {
        setWarnings((w) => [...w, `Kon "${result.gebouwNaam}" niet automatisch aan een gebouw koppelen — kies het gebouw manueel per rij.`]);
      }
    });
  }

  function updateDraft(key: string, field: keyof ReservationInput, value: string) {
    setDrafts((prev) => (prev ? prev.map((d) => (d.key === key ? { ...d, [field]: value } : d)) : prev));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => (prev ? prev.filter((d) => d.key !== key) : prev));
  }

  function handleSave() {
    if (!drafts || drafts.length === 0) return;
    startTransition(async () => {
      const result = await saveReservations(drafts.map(({ key, ...rest }) => rest));
      if (!result.ok) {
        setError(result.error || "Bewaren mislukt.");
        return;
      }
      setSaved(true);
      setDrafts(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setSaved(false), 4000);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] p-5 mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <label className="px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold flex items-center gap-2 cursor-pointer">
          <Upload size={15} /> PDF kiezen
          <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
        </label>
        {pending && <span className="text-sm text-[#8A8FA8]">Bezig...</span>}
        {saved && (
          <span className="text-sm text-[#1B8E63] font-medium flex items-center gap-1">
            <CheckCircle2 size={15} /> Bewaard
          </span>
        )}
      </div>

      {error && (
        <div className="bg-[#FCEDEC] text-[#B4231C] text-sm rounded-xl px-4 py-3 mt-3">{error}</div>
      )}

      {warnings.length > 0 && (
        <div className="bg-[#FDF0DA] text-[#8A5A16] text-sm rounded-xl px-4 py-3 mt-3 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
            </div>
          ))}
        </div>
      )}

      {drafts && drafts.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-[#5B5F82] mb-3">
            {drafts.length} reservatie(s) herkend. Controleer en pas aan waar nodig, verwijder rijen die niet
            moeten opgeslagen worden, en bewaar dan.
          </p>
          <div className="overflow-x-auto border border-[#ECECF3] rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F7FB] text-[#8A8FA8] text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Gebouw</th>
                  <th className="text-left px-3 py-2 font-semibold">Huurder</th>
                  <th className="text-left px-3 py-2 font-semibold">Activiteit</th>
                  <th className="text-left px-3 py-2 font-semibold">Ruimte</th>
                  <th className="text-left px-3 py-2 font-semibold">Begin</th>
                  <th className="text-left px-3 py-2 font-semibold">Eind</th>
                  <th className="text-left px-3 py-2 font-semibold">Toegang</th>
                  <th className="text-left px-3 py-2 font-semibold">Activiteit uur</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d) => (
                  <tr key={d.key} className="border-t border-[#ECECF3] align-top">
                    <td className="px-3 py-2">
                      <select
                        value={d.buildingId}
                        onChange={(e) => updateDraft(d.key, "buildingId", e.target.value)}
                        className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm"
                      >
                        {buildings.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input value={d.huurder} onChange={(e) => updateDraft(d.key, "huurder", e.target.value)} className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm w-40" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={d.activiteit} onChange={(e) => updateDraft(d.key, "activiteit", e.target.value)} className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm w-32" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={d.ruimte} onChange={(e) => updateDraft(d.key, "ruimte", e.target.value)} className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm w-40" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="date" value={d.beginDatum} onChange={(e) => updateDraft(d.key, "beginDatum", e.target.value)} className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="date" value={d.eindDatum} onChange={(e) => updateDraft(d.key, "eindDatum", e.target.value)} className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm" />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <input value={d.toegangStart ?? ""} onChange={(e) => updateDraft(d.key, "toegangStart", e.target.value)} placeholder="start" className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm w-16" />
                      {" – "}
                      <input value={d.toegangEind ?? ""} onChange={(e) => updateDraft(d.key, "toegangEind", e.target.value)} placeholder="eind" className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm w-16" />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <input value={d.activiteitStart ?? ""} onChange={(e) => updateDraft(d.key, "activiteitStart", e.target.value)} placeholder="start" className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm w-16" />
                      {" – "}
                      <input value={d.activiteitEind ?? ""} onChange={(e) => updateDraft(d.key, "activiteitEind", e.target.value)} placeholder="eind" className="rounded-lg border border-[#ECECF3] px-2 py-1 text-sm w-16" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeDraft(d.key)} className="text-[#B0B4CC] hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={handleSave}
            disabled={pending}
            className="mt-4 px-5 py-2.5 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
          >
            {drafts.length} reservatie(s) bewaren
          </button>
        </div>
      )}
    </div>
  );
}
