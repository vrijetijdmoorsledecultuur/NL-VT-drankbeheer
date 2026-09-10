"use client";

import { useState, useTransition } from "react";
import { Mail, Copy, Check, Trash2, MessageCircle } from "lucide-react";
import type { ReservationToegangscode } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { plantToegangscode, verstuurToegangscodeNu, verwijderToegangscode } from "@/app/(app)/controle/actions";

export default function ToegangscodePaneel({
  reservationId,
  toegangscodes,
  onChanged,
}: {
  reservationId: string;
  toegangscodes: ReservationToegangscode[];
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [toegangEmail, setToegangEmail] = useState("");
  const [verstuurOp, setVerstuurOp] = useState("");
  const [geldigTot, setGeldigTot] = useState("");
  const [toegangError, setToegangError] = useState<string | null>(null);
  const [gekopieerdId, setGekopieerdId] = useState<string | null>(null);

  function handlePlanToegangscode() {
    setToegangError(null);
    if (!toegangEmail.trim()) {
      setToegangError("Vul een e-mailadres in.");
      return;
    }
    if (!verstuurOp || !geldigTot) {
      setToegangError("Vul zowel het verzendmoment als de geldigheidsdatum in.");
      return;
    }
    startTransition(async () => {
      const res = await plantToegangscode(reservationId, toegangEmail, verstuurOp, geldigTot);
      if (!res.ok) {
        setToegangError(res.error);
        return;
      }
      setToegangEmail("");
      setVerstuurOp("");
      setGeldigTot("");
      onChanged();
    });
  }

  function kopieerLink(code: string, id: string) {
    const link = `${window.location.origin}/gast/${code}`;
    navigator.clipboard.writeText(link).then(() => {
      setGekopieerdId(id);
      setTimeout(() => setGekopieerdId(null), 2000);
    });
  }

  function deelViaWhatsapp(code: string) {
    const link = `${window.location.origin}/gast/${code}`;
    const bericht = `Registreer jullie drankverbruik via deze link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(bericht)}`, "_blank");
  }

  function handleVerstuurNu(id: string) {
    startTransition(async () => {
      const res = await verstuurToegangscodeNu(id, window.location.origin);
      if (!res.ok) setToegangError(res.error);
      onChanged();
    });
  }

  function handleVerwijderToegangscode(id: string) {
    if (!confirm("Deze geplande code verwijderen? De link werkt dan niet meer.")) return;
    startTransition(async () => {
      await verwijderToegangscode(id);
      onChanged();
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-[#ECECF3] p-5">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-8 h-8 rounded-lg bg-[#E7F0FD] text-[#2F6FCB] flex items-center justify-center shrink-0">
          <Mail size={15} />
        </div>
        <div className="font-bold text-[#171A2B]">Externe toegangscode</div>
      </div>
      <p className="text-xs text-[#8A8FA8] mb-4">
        Voor kleinere activiteiten met &eacute;&eacute;n verantwoordelijke: verstuur automatisch een code waarmee
        die persoon zelf, zonder account, het verbruik van deze reservatie registreert. Telt pas mee na
        goedkeuring, net als bij het poetspersoneel.
      </p>

      {toegangscodes.length > 0 && (
        <div className="divide-y divide-[#ECECF3] mb-4 border border-[#ECECF3] rounded-lg">
          {toegangscodes.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div>
                <span className="font-mono font-semibold text-[#171A2B]">{t.code}</span>
                <span className="text-xs text-[#8A8FA8] ml-2">
                  naar {t.verstuur_email} &middot;{" "}
                  {t.verstuurd ? "verstuurd" : `gepland om ${t.verstuur_op ? formatDateTime(t.verstuur_op) : "?"}`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {!t.verstuurd && (
                  <button
                    onClick={() => handleVerstuurNu(t.id)}
                    disabled={pending}
                    className="text-[11px] font-semibold text-[#6D5AE6] px-2 py-1 rounded-lg border border-[#ECECF3] hover:bg-[#F7F7FB] disabled:opacity-50"
                  >
                    Verstuur nu
                  </button>
                )}
                <button onClick={() => deelViaWhatsapp(t.code)} className="text-[#1FAE7A] p-1" title="Deel via WhatsApp">
                  <MessageCircle size={14} />
                </button>
                <button onClick={() => kopieerLink(t.code, t.id)} className="text-[#6D5AE6] p-1">
                  {gekopieerdId === t.id ? <Check size={14} /> : <Copy size={14} />}
                </button>
                <button onClick={() => handleVerwijderToegangscode(t.id)} className="text-[#B0B4CC] hover:text-[#D6493C] p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">E-mailadres</label>
          <input
            type="email"
            value={toegangEmail}
            onChange={(e) => setToegangEmail(e.target.value)}
            placeholder="verantwoordelijke@voorbeeld.be"
            className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Versturen om</label>
          <input
            type="datetime-local"
            value={verstuurOp}
            onChange={(e) => setVerstuurOp(e.target.value)}
            className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2.5 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#8A8FA8] uppercase tracking-wide">Geldig tot</label>
          <input
            type="datetime-local"
            value={geldigTot}
            onChange={(e) => setGeldigTot(e.target.value)}
            className="w-full mt-1 rounded-lg border border-[#ECECF3] px-2.5 py-1.5 text-sm"
          />
        </div>
      </div>
      {toegangError && <div className="text-xs text-[#D6493C] mt-2">{toegangError}</div>}
      <button
        onClick={handlePlanToegangscode}
        disabled={pending}
        className="mt-3 px-4 py-2 rounded-lg bg-[#6D5AE6] text-white text-sm font-semibold disabled:opacity-50"
      >
        {pending ? "Bezig\u2026" : "Inplannen"}
      </button>
    </div>
  );
}
